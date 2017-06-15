import {replace, traverse} from 'math-traverse'

import {patternToMatchFn, patternToRewriteFn} from './pattern'
import {match} from './matcher'
import {checkBounds, clone, fixMinuses, removeUnnecessaryParentheses} from './utils'

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
export const canApplyRule = (rule, node) => {
    return !!match(rule.matchFn, node, rule.constraints)
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

    if (matchedNode) {
        const replacement = fixMinuses(rewriteFn(matchedNode, placeholders, indexes))
        return removeUnnecessaryParentheses(replace(input, {
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
    } else {
        return input
    }
}
