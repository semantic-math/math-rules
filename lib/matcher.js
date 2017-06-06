/**
 * Functions for finding a matching sub-tree within an AST.
 */
import {build, query} from 'math-nodes'
import {print} from 'math-parser'
import evaluate from 'math-evaluator'
import {replace, traverse} from 'math-traverse'

import {
    checkBounds,
    clone,
    fixMinuses,
    getPlaceholders,
    isVariableLengthPattern,
    removeUnnecessaryParentheses,
} from './utils'

const isArray = (val) => Array.isArray(val)
const isObject = (val) => typeof val === 'object' && val !== null
const isFunction = (val) => typeof val === 'function'

const isPlaceholder = node => node && node.type === 'Placeholder'

// TODO: handle reverse variable length patterns, e.g.
// ... + #a_0

const expandVariableLengthPatternNode = (pattern, length, negatives) => {
    const firstPattern = pattern.args[0]
    const firstPlaceholders = clone(getPlaceholders(firstPattern))

    const expandedPattern = clone(pattern)
    expandedPattern.args = []

    const subscriptCounters = {}

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
                        const result = expandVariableLengthPatternNode(node, length, negatives)
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
                        skipExpansion = false
                    }
                }
            })

        expandedPattern.args.push(currentPattern)
    }

    expandedPattern.wasExpanded = true

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
        if (key === 'args' && (query.isMul(pattern) && query.isMul(input) || query.isAdd(pattern) && query.isAdd(input))) {
            for (let i = 0; i <= input.args.length - pattern.args.length; i++) {
                // we need to be able to recover from a failed match at for
                // each sub-array so we copy the matched nodes before doing
                // the comparison.
                const placeholdersCopy = {...placeholders}
                const negatives = {}

                let j = i
                const allArgsMatch = pattern.args.every((_, index) => {
                    if (j >= input.args.length) {
                        return
                    }

                    let currentPattern = pattern.args[index]
                    if (currentPattern.type === 'Ellipsis') {
                        const subscriptCounters = {}
                        const previousPattern = pattern.args[index - 1]
                        const k = j
                        while (j < input.args.length) {
                            currentPattern = replace(
                                clone(previousPattern),
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

                            let arg = input.args[j]

                            if (query.isAdd(pattern)) {
                                // Keep track of which items in the expandable part
                                // of the pattern are negative.
                                negatives[j - i] = query.isAdd(pattern) && query.isNeg(arg)
                                    ? {wasMinus: arg.wasMinus}
                                    : null

                                // If the the pattern is an 'add' then we'll want to
                                // unwrap any 'neg' nodes before matching so that we
                                // can match + and - terms in the same expression
                                if (query.isNeg(arg)) {
                                    arg = arg.args[0]
                                }
                            }

                            if (!_matchNode(
                                    currentPattern,
                                    pattern, // parent
                                    arg,
                                    constraints,
                                    placeholdersCopy)) {
                                break
                            } else {
                                j++
                            }
                        }

                        // success if we matched at least one other node in the
                        // variable part of the pattern
                        return j > k
                    } else {
                        return _matchNode(
                            currentPattern,
                            pattern, // parent
                            input.args[j++],
                            constraints,
                            placeholdersCopy)
                    }
                })

                if (allArgsMatch) {
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
        enter(node) {
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

                return expandVariableLengthPatternNode(node, length, placeholders.negatives)
            }
        }
    })

    return replace(expandedPattern, {
        leave(node) {
            if (node.type === 'Apply' && isPlaceholder(node.op) && node.op.name === 'eval') {
                return build.numberNode(evaluate(node.args[0]))
            } else if (node.type === 'Placeholder' && node.name in placeholders) {
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
    (node, placeholders) => removeUnnecessaryParentheses(populatePattern(pattern, placeholders))


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
 * Given an inputAST and a node to match, return an array with
 * the path from the AST to the node. Accounts for multiple paths
 *
 * @param {input} input AST
 * @param {node} subtree of input to be matched
 * @param {path} an array of steps to be outputted
 * @param {allPathsFound} an array containing duplicate paths if any
 */

export const getPath = (input, node, path, allPathsFound) => {
    if (print(input) === print(node)) {
        allPathsFound.push(path)
    } else {
        for (var i in input.args){
            getPath(input.args[i]
                         , node
                         , path.concat(['args', i])
                         , allPathsFound)
        }
    }
    return allPathsFound
}

/**
 *
 * Given an inputAST and a path, return the node at the path
 * @param {input} input AST
 * @param {path} array containing steps to a node in the input AST
 */
export const getNodeAtPath = (input, path) => {
    let ast = input
    path.forEach(arg => {
        if(arg == 'args') {
            ast = ast.args
        } else if (Number.isInteger(arg)) {
            ast = ast[arg]
        } else if (arg == 'subscript') {
            ast = ast.subscript
        } else if (arg == 'superscript') {
            ast = ast.subscript
        } else if (isArray(arg)) {
            let output = []
            arg.forEach(arg => {
                if (!ast[arg]) {
                    throw new Error ("index out of bound")
                }
                output.push(ast[arg])
            })
            ast = output
        } else {
            throw new Error ("cannot resolve path")
        }
    })
    return ast
}

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

    const inputPath = getPath(input, matchedNode, [], [])
    console.log(inputPath)

    if (matchedNode) {
        const replacement = fixMinuses(rewriteFn(matchedNode, placeholders, indexes))
        console.log(replacement)
        const result =  removeUnnecessaryParentheses(replace(input, {
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
        }))
        const outputPath = getPath(result, replacement, [], [])
        console.log(outputPath)
        return result
    } else {
        return input
    }
}
