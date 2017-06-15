/**
 * Functions for finding a matching sub-tree within an AST.
 */
import {build, query} from 'math-nodes'
import {print} from 'math-parser'
import {replace, traverse} from 'math-traverse'

import {clone, getPlaceholders, isVariableLengthPattern} from './utils'

const isArray = (val) => Array.isArray(val)
const isObject = (val) => typeof val === 'object' && val !== null
const isFunction = (val) => typeof val === 'function'

/**
 * Expand a variable length pattern.
 *
 * Examples:
 *   #a_0 + ... -> #a_0 + #a_1 + #a_2 (length = 3)
 *   #b_0 * ... -> #b_0 * #b_1 * #b_2 * #b_4 (length = 4)
 *
 * Since 'add' nodes can contain a mix of positive and negative numbers, some
 * of which may have been minuses when they were parse, this function takes an
 * optional 'negatives' array which describes which nodes should be separated
 * by minus signs, e.g.
 *
 *   pattern: #a_0 + ...
 *   length: 3
 *   negatives: [null, {wasMinus: true}, null]
 *
 * will result in
 *
 *   #a_0 - #a_1 + #a_2
 */
export const _expandVariableLengthPatternNode = (pattern, length, negatives) => {
    const firstPattern = pattern.args[0]
    const firstPlaceholders = clone(getPlaceholders(firstPattern))

    const expandedPattern = clone(pattern)
    expandedPattern.args = []

    const subscriptCounters = {}

    // Variable length patterns can be nested so we need to guard against
    // expanding them more than once.  For an example, see COMMON_DENOMINATOR
    // in rule-list.js.
    let skipExpansion = false

    for (let i = 0; i < length; i++) {
        const currentPattern = replace(
            clone(firstPattern),
            {
                enter(node) {
                    if (skipExpansion) {
                        return
                    }

                    if (node.wasExpanded) {
                        skipExpansion = true
                    } else if (isVariableLengthPattern(node)) {
                        const result = _expandVariableLengthPatternNode(node, length, negatives)
                        if (result.wasExpanded) {
                            skipExpansion = true
                        }
                        return result
                    } else if (node.type === 'Placeholder' && node.subscript) {
                        const name = node.name
                        if (!subscriptCounters.hasOwnProperty(name)) {
                            subscriptCounters[name] = 0
                        }
                        node.subscript.value = String(i)
                    }
                },
                leave(node) {
                    if (node.wasExpanded) {
                        // Reset the skipExpansion flag so that we can continue
                        // to expand other patterns that might appear in the
                        // current node.
                        skipExpansion = false
                    }
                }
            })

        expandedPattern.args.push(currentPattern)
    }

    expandedPattern.wasExpanded = true

    // Convert any nodes to negatives and set their 'wasMinus' flag based on
    // the 'negatives' array.
    if (query.isAdd(expandedPattern) && negatives) {
        for (let i = 0; i < expandedPattern.args.length; i++) {
            if (negatives[i]) {
                expandedPattern.args[i] = build.applyNode(
                    'neg', [expandedPattern.args[i]], negatives[i])
            }
        }
    }

    return expandedPattern
}

/**
 * Match a placeholder and enforce constraints.
 *
 * The first a placeholder is matched we only verify the constraint for that
 * placeholder.  We store a copy of the node that was matched and verify all
 * subsequent attempts to match that placeholder against the stored node.
 *
 * When matching placeholders with subscripts, we verify a single constraint
 * against all placeholders with the same name, e.g. #a_0, #a_1, ... will all
 * be checked against the constraint 'a' if exists.
 *
 * Matched nodes for #a_0, #a_1, ... are stored in an array in placeholders
 * under the key 'a'.
 */
const _matchPlaceholder = (pattern, input, context) => {
    const {constraints, placeholders} = context
    const hasConstraint = pattern.name in constraints
    const {name} = pattern
    const meetsConstraint = hasConstraint && constraints[pattern.name](input)

    if (!hasConstraint || meetsConstraint) {
        if (pattern.subscript) {
            const subscript = print(pattern.subscript)

            if (placeholders[name] && placeholders[name][subscript]) {
                return _matchNode(
                    placeholders[name][subscript],
                    input,
                    context)
            } else if (placeholders[name]) {
                placeholders[name][subscript] = clone(input)
                return true
            } else {
                placeholders[name] = {
                    [subscript]: clone(input)
                }
                return true
            }
        } else {
            if (name in placeholders) {
                return _matchNode(placeholders[name], input, context)
            } else {
                placeholders[name] = clone(input)
                return true
            }
        }
    }
}

/**
 * If an ellipsis follows an argument in an 'add' or 'mul' node that contains
 * a placeholder with a subscript, then we attempt to match that argument
 * multiple times, e.g. given:
 *
 * pattern: #a_0 / #b_0 + ...
 * input: 1 + 1/2 + 2/3 + 3/4 + 5
 *
 * The function will match 2/3 and 3/4.  It doesn't match the 1/2 because that
 * was matched by _matchSubArray before this function was called.
 */
const _matchExpandableEllipsis = (
    pattern,
    patternIndex,
    input,
    inputIndex,
    context,
    negatives,
) => {

    const subscriptCounters = {}
    const initialPattern = pattern.args[patternIndex - 1]

    const matchedArgs = []

    for (let i = inputIndex; i < input.args.length; i++) {
        let arg = input.args[i]

        if (query.isAdd(pattern)) {
            if (query.isNeg(arg)) {
                // Keep track of which items in the expandable part the pattern
                // are negative.
                negatives[i] = {wasMinus: arg.wasMinus}

                // If the the pattern is an 'add' then we'll want to unwrap any
                // 'neg' nodes before matching so that we can match +/- terms
                // in the same expression.
                arg = arg.args[0]
            }
        }

        // Increment subscripts in placeholder nodes by one each time through
        // this loop, e.g.
        // #a_0 / #b_0 -> #a_1 / #b_1, #a_2 / #b_2, ...
        const currentPattern = replace(
            clone(initialPattern),
            {
                leave(node) {
                    if (node.type === 'Placeholder' && node.subscript) {
                        const name = node.name
                        if (!subscriptCounters.hasOwnProperty(name)) {
                            subscriptCounters[name] = 1
                        }
                        node.subscript.value = String(subscriptCounters[name]++)
                    }
                }
            }
        )

        if (_matchNode(currentPattern, arg, context)) {
            matchedArgs.push(arg)
        } else {
            break
        }
    }

    // success if we matched at least one other node in the
    // variable part of the pattern
    return matchedArgs.length
}

/**
 * Patterns that match 'add' or 'mul' nodes need to match a sub array of args
 * so that rules like '#a + #b -> #b + #a' can be used in 'add' nodes with
 * more than two args, e.g. '1 + 2 + 3'.
 *
 * This function also handles matching variable length expressions such as
 * '#a_0 + ...' which can match any number of args within an 'add' node.
 * See _matchExpandableEllipsis for more information.
 */
const _matchSubArray = (input, pattern, context, indexes) => {
    const {constraints, placeholders} = context

    for (let i = 0; i <= input.args.length - pattern.args.length; i++) {
        // we need to be able to recover from a failed match at for
        // each sub-array so we copy the matched nodes before doing
        // the comparison.
        const placeholdersCopy = {...placeholders}
        const negatives = {}

        let j = i
        const allPatternArgsMatch = pattern.args.every((patternArg, patternIndex) => {
            if (j >= input.args.length) {
                return
            }

            const currentContext = {...context, placeholders: placeholdersCopy}

            if (patternArg.type === 'Ellipsis') {
                const diff = _matchExpandableEllipsis(
                    pattern,
                    patternIndex,
                    input,
                    j,  // inputIndex
                    currentContext,
                    negatives,
                )

                if (diff > 0) {
                    j += diff
                    return true
                } else {
                    return false
                }
            } else {
                return _matchNode(patternArg, input.args[j++], currentContext)
            }
        })

        if (allPatternArgsMatch) {
            indexes.start = i
            indexes.end = j

            // matchNodesCopy may have been updated to copy over any
            // new entries to matchedNodes
            Object.assign(placeholders, placeholdersCopy)

            // TODO: find a better place to put this
            // If there are negatives that need to be tracked at
            // different levels in the pattern then this approach isn't
            // robust enough.
            if (Object.keys(negatives).length > 0) {
                placeholders.negatives = negatives
            }

            return true
        }
    }
    return false
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
    input,
    context,
    indexes = {},
) => {
    if (pattern.type === 'Placeholder') {
        return _matchPlaceholder(pattern, input, context)
    }

    // filter out keys we want to ignore
    const ignoreKeys = ['loc', 'implicit']
    const patternKeys = Object.keys(pattern).filter(key => !ignoreKeys.includes(key))
    const nodeKeys = Object.keys(input).filter(key => !ignoreKeys.includes(key))

    if (patternKeys.length !== nodeKeys.length) {
        return false
    }

    // all keys must match
    return patternKeys.every(key => {
        if (key === 'args' && (query.isMul(pattern) && query.isMul(input) || query.isAdd(pattern) && query.isAdd(input))) {
            return _matchSubArray(
                input,
                pattern,
                context,
                indexes,
            )
        } else if (isObject(pattern[key])) {
            return _matchNode(
                pattern[key],
                input[key],
                context)
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
    const context = {constraints, placeholders}

    if (_matchNode(pattern, input, context, indexes)) {
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
