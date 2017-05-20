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

    const expandedPattern = clone(pattern)
    expandedPattern.args = []

    for (let i = 0; i < length; i++) {
        const currentPattern = replace(
            clone(firstPattern),
            {
                leave(node) {
                    if (node.type === 'Placeholder' && node.subscript) {
                        node.subscript.value = String(i)
                    }
                }
            })

        expandedPattern.args.push(currentPattern)
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

const ignoreKeys = ['loc', 'implicit']

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

    // filter out keys we want to ignore
    const patternKeys = Object.keys(pattern).filter(key => !ignoreKeys.includes(key))
    const nodeKeys = Object.keys(input).filter(key => !ignoreKeys.includes(key))

    if (patternKeys.length !== nodeKeys.length) {
        return false
    }

    // all keys must match
    return patternKeys.every(key => {
        if (key === 'args' && isVariableLengthPattern(pattern)) {

            if (query.isMul(pattern) && query.isMul(input) || query.isAdd(pattern) && query.isAdd(input)) {
                for (let i = 0; i < input.args.length - 1; i++) {
                    // we need to be able to recover from a failed match at for
                    // each sub-array so we copy the matched nodes before doing
                    // the comparison.
                    const placeholdersCopy = {...placeholders}

                    const firstPattern = pattern.args[0]
                    const firstPlaceholders = clone(getPlaceholders(firstPattern))

                    let subscript = 0
                    let j

                    for (j = i; j < input.args.length; j++) {
                        const currentPattern = replace(
                            clone(firstPattern),
                            {
                                leave(node) {
                                    if (node.type === 'Placeholder' && node.subscript) {
                                        node.subscript.value = String(subscript++)
                                    }
                                }
                            })

                        const matchResult = _matchNode(
                            currentPattern,
                            pattern,
                            input.args[j],
                            constraints,
                            placeholdersCopy)

                        if (!matchResult) {
                            break
                        }
                    }

                    if (j - i > 1) {
                        // matchNodesCopy may have been updated to copy over any
                        // new entries to matchedNodes
                        Object.assign(placeholders, placeholdersCopy)

                        indexes.start = i
                        indexes.end = j

                        return true
                    }
                }
                return false

            } else {
                return _matchNode(
                    expandVariableLengthPatternNode(pattern, input.args.length),
                    patternParent,
                    input,
                    constraints,
                    placeholders)
            }

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

/**
 * Match a pattern against a single node.
 *
 * If the input node matches the pattern return a match record containing the
 * values of the placeholders that were matched and the start and end indexes
 * if part of a 'add' or 'mul' node's args were matched.
 */
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
export const match = (matchFn, input, constraints = {}) => {
    let result = null

    traverse(input, {
        leave(node) {
            if (!result) {
                result = matchFn(node)
            }
        },
    })

    return result
}

/**
 * Replace any Placeholder nodes in an AST pattern with values from a
 * placeholder dictionary.
 *
 * This handles expansion of variable length patterns.
 */
export const populatePattern = (pattern, placeholders) => {
    const expandedPattern = replace(clone(pattern), {
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

    return replace(expandedPattern, {
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


export const patternToMatchFn = (pattern, constraints) =>
    node => {
        const result = matchNode(pattern, node, constraints)
        if (result) {
            return {
                node,
                ...result,
            }
        } else {
            return null
        }
    }

export const patternToRewriteFn = pattern =>
    (node, placeholders) => populatePattern(pattern, placeholders)


// Public API

/**
 * Define a rewrite rule.
 *
 * While this function provides more flexibility when defining rewrite rules,
 * it's harder to use.  Use definePatternRule whenever possible.
 *
 * @param {Function} matchFn a function taking an AST returning a match result
 * @param {Function} rewriteFn a function taking an AST and placeholders object
 * and returning an updated copy of the AST
 * @param {Object} [constraints] an optional dictionary with placholder names
 * for keys and functions for values.  The functions take an AST node and return
 * a boolean.
 */
export const defineRule = (matchFn, rewriteFn, constraints = {}) => {
    return {
        matchFn,
        rewriteFn,
        constraints,
    }
}

/**
 * Define a rewrite rule using patterns.
 *
 * @param {node} matchPattern pattern to match
 * @param {node} rewritePattern pattern to output
 * @param {Object} constraints object with placeholder names for keys and
 * functions taking nodes and return booleans as values
 */
export const definePatternRule = (matchPattern, rewritePattern, constraints = {}) => {
    // TODO: sanity checking for patterns being passed in
    // - rewritePattern can't have any Pattern nodes with names not in matchPattern
    const matchFn = patternToMatchFn(matchPattern, constraints)
    const rewriteFn = patternToRewriteFn(rewritePattern)
    return defineRule(matchFn, rewriteFn, constraints)
}

/**
 * Check if the rule can be applied before actually applying it.
 */
export const canApplyRule = (rule, node) =>
    !!match(rule.matchFn, node, rule.constraints)

/**
 * Apply a rule to the given input pattern.
 *
 * Match a single node in input based on matchPattern.  If a match is found,
 * the node will be replaced with the rewritePattern with all of the pattern's
 * placeholder nodes replaced with the placeholder values determined when making
 * the initial match.
 */
export const applyRule = (rule, input) => {
    const {matchFn, rewriteFn, constraints} = rule
    const {node, placeholders, indexes} = match(matchFn, input, constraints)
    const matchedNode = node

    if (matchedNode) {
        const replacement = fixMinuses(rewriteFn(matchedNode, placeholders, indexes))
        return replace(input, {
            leave(node) {
                if (node === matchedNode) {
                    if (indexes && checkBounds(indexes, node.args)) {

                        const {start, end} = indexes
                        // TODO: make running that pass optional so that it
                        // can be done separately if necessary
                        node.args.splice(start, end - start, clone(replacement))
                    } else {
                        return clone(replacement)
                    }
                }
            }
        })
    } else {
        return input
    }
}
