/**
 * Functions for finding a matching sub-tree within an AST.
 */
import {build, query} from 'math-nodes'
import {print} from 'math-parser'
import {replace, traverse} from 'math-traverse'

import {
    checkBounds,
    clone,
    fixMinuses,
    getPlaceholders,
    isVariableLengthPattern,
} from './utils'

const isArray = (val) => Array.isArray(val)
const isObject = (val) => typeof val === 'object' && val !== null
const isFunction = (val) => typeof val === 'function'

// TODO: handle reverse variable length patterns, e.g.
// ... + #a_0

const expandVariableLengthPatternNode = (pattern, length) => {
    const firstPattern = pattern.args[0]
    const firstPlaceholders = clone(getPlaceholders(firstPattern))

    let variablePlaceholder = null
    for (const [name, placeholder] of Object.entries(firstPlaceholders)) {
        if (placeholder.subscript) {
            variablePlaceholder = placeholder
            break
        }
    }

    firstPlaceholders[variablePlaceholder.name] = {
        '0': variablePlaceholder,
    }

    const expandedPattern = clone(pattern)
    expandedPattern.args = []
    for (let i = 0; i < length; i++) {
        variablePlaceholder.subscript.value = String(i)
        expandedPattern.args.push(
            populatePattern(firstPattern, firstPlaceholders)
        )
    }

    return expandedPattern
}

const _matchPlaceholder = (pattern, input, constraints, placeholders) => {
    const hasConstraint = pattern.name in constraints
    const meetsConstraint = hasConstraint && constraints[pattern.name](input)

    if (!hasConstraint || meetsConstraint) {
        if (pattern.subscript) {
            const subscript = print(pattern.subscript)

            if (placeholders[pattern.name] && placeholders[pattern.name][subscript]) {
                return _matchNode(
                    placeholders[pattern.name][subscript],
                    pattern, // parent
                    input,
                    constraints,
                    placeholders)
            } else if (placeholders[pattern.name]) {
                placeholders[pattern.name][subscript] = clone(input)
                return true
            } else {
                placeholders[pattern.name] = {
                    [subscript]: clone(input)
                }
                return true
            }
        } else {
            if (pattern.name in placeholders) {
                return _matchNode(
                    placeholders[pattern.name],
                    pattern, // parent
                    input,
                    constraints,
                    placeholders)
            } else {
                placeholders[pattern.name] = clone(input)
                return true
            }
        }
    }
}

/**
 * Match input node with pattern node.
 *
 * Returns true if the input node matches the pattern.  All descendants of the
 * nodes must match to be considered a match.  Placeholder nodes within pattern
 * will match any node in the input.  Once a match has been made for a
 * Placeholder with a given name, any other Placeholders with the same name
 * must match the same node.
 *
 * Afte the call returns, placeholders will hold a map from placeholder names
 * to sub nodes somewhere in input.  indexes will hold {start, end} objects
 * representing partial matches of an add operation's args within a large add
 * operation or a mul operation's args within a larger mul operation.
 */
const _matchNode = (
    pattern,
    patternParent,
    input,
    constraints = {},
    placeholders = {},
    indexes = {},
) => {
    if (pattern.type === 'Placeholder') {
        return _matchPlaceholder(pattern, input, constraints, placeholders)
    }

    // filter out metatdata keys
    const patternKeys = Object.keys(pattern).filter(key => key !== 'loc')
    const nodeKeys = Object.keys(input).filter(key => key !== 'loc')

    if (patternKeys.length !== nodeKeys.length) {
        return false
    }

    // all keys must match
    return patternKeys.every(key => {
        if (key === 'args' && isVariableLengthPattern(pattern)) {
            return _matchNode(
                expandVariableLengthPatternNode(pattern, input.args.length),
                patternParent,
                input,
                constraints,
                placeholders)

            // then start matching items starting from the variable placeholder
            // with the one/zero subscript working from either right or left
            // depending on the location of tha placeholder in the args array

        } else if (key === 'args' && (query.isMul(pattern) && query.isMul(input) || query.isAdd(pattern) && query.isAdd(input))) {

            for (let i = 0; i <= input.args.length - pattern.args.length; i++) {
                // we need to be able to recover from a failed match at for
                // each sub-array so we copy the matched nodes before doing
                // the comparison.
                const placeholdersCopy = {...placeholders}
                const subArray = input.args.slice(i, i + pattern.args.length)
                const allArgsMatch = pattern.args.every((_, index) =>
                    _matchNode(
                        pattern.args[index],
                        pattern, // parent
                        subArray[index],
                        constraints,
                        placeholdersCopy)
                )

                if (allArgsMatch) {
                    indexes.start = i
                    indexes.end = i + pattern[key].length
                    // matchNodesCopy may have been updated to copy over any
                    // new entries to matchedNodes
                    Object.assign(placeholders, placeholdersCopy)
                    return true
                }
            }
            return false
        } else if (isObject(pattern[key])) {
            return _matchNode(
                pattern[key],
                pattern, // parent
                input[key],
                constraints,
                placeholders)
        } else {
            return pattern[key] === input[key]
        }
    })
}

export const matchNode = (
    pattern,
    input,
    constraints = {}
) => {
    const placeholders = {}
    const indexes = {}

    if (_matchNode(pattern, null, input, constraints, placeholders, indexes)) {
        return {placeholders, indexes}
    } else {
        return null
    }
}

/**
 * Match a pattern against all nodes in the input AST.
 */
export const match = (pattern, input, constraints = {}) => {
    let result = null

    traverse(input, {
        leave(node) {
            if (!result) {
                if (isFunction(pattern)) {
                    if (pattern(node)) {
                        result = {
                            node: node,
                        }
                    }
                } else {
                    const nodeMatch = matchNode(pattern, node, constraints)

                    if (nodeMatch) {
                        result = {
                            node: node,
                            placeholders: nodeMatch.placeholders,
                            indexes: nodeMatch.indexes,
                        }
                    }
                }
            }
        },
    })

    return result
}

export const populatePattern = (pattern, placeholders) => {
    const expandedPattern = expandVariableLengthPattern(pattern, placeholders)

    return replace(clone(expandedPattern), {
        leave(node) {
            if (node.type === 'Placeholder' && node.name in placeholders) {
                if (node.subscript) {
                    const subscript = print(node.subscript)
                    return clone(placeholders[node.name][subscript])
                } else {
                    return clone(placeholders[node.name])
                }
            }
        }
    })
}

const expandVariableLengthPattern = (pattern, placeholders) =>  {
    return replace(clone(pattern), {
        leave(node) {
            if (isVariableLengthPattern(node)) {
                const firstPattern = node.args[0]
                const firstPlaceholders = clone(getPlaceholders(firstPattern))

                let variablePlaceholder = null
                for (const [name, placeholder] of Object.entries(firstPlaceholders)) {
                    if (placeholder.subscript) {
                        variablePlaceholder = placeholder
                        break
                    }
                }

                const values = placeholders[variablePlaceholder.name]
                const length = parseInt(Math.max(...Object.keys(values))) + 1

                return expandVariableLengthPatternNode(node, length)
            }
        }
    })
}

/**
 * Rewrite matches a single node in input based on matchPattern.  If a match
 * is found it will replace that single node with the rewritePattern.
 *
 * If rewritePattern contains Placeholder nodes, these will be replace with
 * clones of the nodes from input that they matched.
 */
export const rewrite = (rule, input) => {
    const {matchPattern, rewriteFunction, constraints} = rule
    const {node, placeholders, indexes} = match(matchPattern, input, constraints)
    const matchedNode = node

    if (matchedNode) {
        const replacement = rewriteFunction(matchedNode, placeholders)
        const fixedReplacement = fixMinuses(replacement)

        return replace(input, {
            leave(node) {
                if (node === matchedNode) {
                    if (indexes && checkBounds(indexes, node.args)) {
                        // TODO: make running that pass optional so that it
                        // can be done separately if necessary
                        node.args.splice(
                            indexes.start,
                            indexes.end - indexes.start,
                            clone(fixedReplacement))
                    } else {
                        return clone(fixedReplacement)
                    }
                }
            }
        })
    }

    return input
}

class Rule {
    constructor(matchPattern, rewriteFunction, constraints = {}) {
        this.matchPattern = matchPattern
        this.rewriteFunction = rewriteFunction
        this.constraints = constraints
    }
}

// Public API

// TODO: sanity checking for patterns being passed in
// - rewritePattern can't have any Pattern nodes with names not in matchPattern
export const defineRule = (matchPattern, rewritePattern, constraints = {}) =>
    new Rule(
        matchPattern,
        isFunction(rewritePattern)
            ? rewritePattern
            : (node, placeholders) => populatePattern(rewritePattern, placeholders),
        constraints)

export const canApplyRule = (rule, node) =>
    !!match(rule.matchPattern, node, rule.constraints)

export const applyRule = (rule, node) => rewrite(rule, node)
