import evaluate from 'math-evaluator'
import {build, query} from 'math-nodes'
import {print} from 'math-parser'
import {replace, traverse} from 'math-traverse'

import {matchNode, _expandVariableLengthPatternNode} from './matcher'
import {clone, isVariableLengthPattern, removeUnnecessaryParentheses, getPlaceholders} from './utils'

const isPlaceholder = node => node && node.type === 'Placeholder'

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

                return _expandVariableLengthPatternNode(node, length, placeholders.negatives)
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

/**
 * Convert pattern AST to matching function.
 *
 * The resulting function accepts an AST node.  Passing this to 'match' along
 * with the root node of an AST will will return the first node whose subtree
 * matches the structured described in the pattern.
 */
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

/**
 * Convert pattern AST to a rewrite function.
 *
 * The resulting function will accept an AST node and a placeholders object.
 * The node passed to the function is the matched node returned by 'match' in
 * applyRule.
 */
export const patternToRewriteFn = pattern =>
    (node, placeholders) => removeUnnecessaryParentheses(populatePattern(pattern, placeholders))
