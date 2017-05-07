/**
 * Functions for finding a matching sub-tree within an AST.
 */
import {replace, traverse} from 'math-traverse'
import {print} from 'math-parser'

const isArray = (val) => Array.isArray(val)
const isObject = (val) => typeof val === 'object' && val !== null
const isFunction = (val) => typeof val === 'function'
const isMul = (node) => node && node.type === 'Apply' && node.op === 'mul'
const isAdd = (node) => node && node.type === 'Apply' && node.op === 'add'

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
    input,
    constraints = {},
    placeholders = {},
    indexes = {}
) => {
    if (pattern.type === 'Placeholder') {
        const hasConstraint = pattern.name in constraints
        const meetsConstraint = hasConstraint && constraints[pattern.name](input)

        if (!hasConstraint || meetsConstraint) {
            if (pattern.name in placeholders) {
                return _matchNode(
                    placeholders[pattern.name],
                    input,
                    constraints,
                    placeholders)
            } else {
                // TODO: enforce constraints on Placeholder
                placeholders[pattern.name] = clone(input)
                return true
            }
        }
    }

    // filter out metatdata keys
    const patternKeys = Object.keys(pattern).filter(key => key !== 'loc')
    const nodeKeys = Object.keys(input).filter(key => key !== 'loc')

    if (patternKeys.length !== nodeKeys.length) {
        return false
    }

    // all keys must match
    return patternKeys.every(key => {
        if (key === 'args' && (isMul(pattern) && isMul(input) || isAdd(pattern) && isAdd(input))) {

            for (let i = 0; i <= input.args.length - pattern.args.length; i++) {
                // we need to be able to recover from a failed match at for
                // each sub-array so we copy the matched nodes before doing
                // the comparison.
                const placeholdersCopy = {...placeholders}
                const subArray = input.args.slice(i, i + pattern.args.length)
                const allArgsMatch = pattern.args.every((_, index) =>
                    _matchNode(
                        pattern.args[index],
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
        } else if (isArray(pattern[key]) && isArray(input[key])) {
            if (pattern[key].length !== input[key].length) {
                return false
            } else {
                return pattern[key].every((elem, index) =>
                    _matchNode(
                        pattern[key][index],
                        input[key][index],
                        constraints,
                        placeholders)
                )
            }
        } else if (isObject(pattern[key])) {
            return _matchNode(
                pattern[key],
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

    if (_matchNode(pattern, input, constraints, placeholders, indexes)) {
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

const clone = node => JSON.parse(JSON.stringify(node))

const checkBounds = (indexes, array) =>
    indexes.start > 0 || indexes.end < array.length - 1

export const populatePattern = (pattern, placeholders) => {
    return replace(clone(pattern), {
        leave(node) {
            if (node.type === 'Placeholder' && node.name in placeholders) {
                return clone(placeholders[node.name])
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
    const {matchPattern, rewritePattern, constraints} = rule
    const {node, placeholders, indexes} = match(matchPattern, input, constraints)
    const matchedNode = node

    if (matchedNode) {

        const replacement = isFunction(rewritePattern)
            ? rewritePattern(node, placeholders)
            : populatePattern(rewritePattern, placeholders)

        return replace(input, {
            leave(node) {
                if (node === matchedNode) {
                    if (indexes && checkBounds(indexes, node.args)) {
                        // TODO: make running that pass optional so that it
                        // can be done separately if necessary
                        node.args.splice(
                            indexes.start,
                            indexes.end - indexes.start,
                            clone(replacement))
                    } else {
                        return clone(replacement)
                    }
                }
            }
        })
    }

    return input
}

// Public API

// TODO: sanity checking for patterns being passed in
// - rewritePattern can't have any Pattern nodes with names not in matchPattern
export const defineRule = (matchPattern, rewritePattern, constraints = {}) => {
    return {matchPattern, rewritePattern, constraints}
}

export const canApplyRule = (rule, node) => {
    return !!match(rule.matchPattern, node, rule.constraints)
}

export const applyRule = (rule, node) => {
    return rewrite(rule, node)
}


/**
 * rules have: input, output patterns... and a set of constraints
 * a rule can also have a input matcher function
 *
 * a pattern can be populated or matched
 *
 */