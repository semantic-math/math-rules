import {parse, print} from 'math-parser'
import evaluate from 'math-evaluator'
import {build, query} from 'math-nodes'
import {traverse} from 'math-traverse'

import {defineRule, definePatternRule, applyRule} from './matcher'
import {isPolynomialTerm, getCoefficient, getVariableFactors} from './rules/collect-like-terms.js'
import {clone, getRanges} from './utils'

const defineRuleString = (matchPattern, rewritePattern, constraints) => {
    const matchAST = parse(matchPattern)
    const rewriteAST = parse(rewritePattern)

    traverse(matchAST, {
        leave(node) {
            delete node.loc
        }
    })

    traverse(rewriteAST, {
        leave(node) {
            delete node.loc
        }
    })

    return definePatternRule(matchAST, rewriteAST, constraints)
}

// ARITHMETIC

// e.g. 2 + 2 -> 4 or 2 * 2 -> 4
// TODO(kevinb): handle fractions
export const SIMPLIFY_ARITHMETIC = defineRule(
    node => {
        if (query.isOperation(node)) {
            if (query.isAdd(node) || query.isMul(node)) {
                if (node.args.every(query.isNumber)) {
                    return {node}
                } else {
                    const ranges = getRanges(node.args, query.isNumber)
                    if (ranges.length > 0) {
                        // For now we're only using the first range, but we'll
                        // want to use all ranges when we're applying a rule
                        // multiple times in the future.
                        const indexes = {
                            start: ranges[0][0],
                            end: ranges[0][1],
                        }
                        return {node, indexes}
                    }
                }
            } else if (node.args.every(query.isNumber)) {
                return {node}
            }
        }
        return null
    },
    // TODO: replace this with '#eval(#a)'
    (node, _, indexes) => {
        const copy = clone(node)
        if (indexes) {
            copy.args = copy.args.slice(indexes.start, indexes.end)
        }
        return parse(String(evaluate(copy)))
    }
)

export const EVALUATE_ADDITION =
    defineRuleString('#a_0 + ...', '#eval(#a_0 + ...)', {a: query.isNumber})

export const EVALUATE_MULTIPLICATION =
    defineRuleString('#a_0 * ...', '#eval(#a_0 * ...)', {a: query.isNumber})

export const EVALUATE_DIVISION = defineRuleString(
    '#a / #b', '#eval(#a / #b)', {a: query.isNumber, b: query.isNumber})

export const EVALUATE_POWER = defineRuleString(
    '#a^#b', '#eval(#a^#b)', {a: query.isNumber, b: query.isNumber})

// NEGATION
// e.g. -(-3) -> 3
export const NEGATION = defineRuleString('--#a', '#a')

// ARITHMETIC
// e.g. 2/-1 -> -2
export const DIVISION_BY_NEGATIVE_ONE = defineRuleString('#a / -1', '-#a')

// e.g. 2/1 -> 2
export const DIVISION_BY_ONE = defineRuleString('#a / 1', '#a')

// e.g. x * 0 -> 0
export const MULTIPLY_BY_ZERO = defineRuleString('#a * 0', '0')

// e.g. 0 * x -> 0
export const MULTIPLY_BY_ZERO_REVERSE = defineRuleString('0 * #a', '0')

// e.g. x ^ 0 -> 1
export const REDUCE_EXPONENT_BY_ZERO = defineRuleString('#a ^ 0', '1')

// e.g. 0 / x -> 0
export const REDUCE_ZERO_NUMERATOR = defineRuleString('0 / #a', '0')

// e.g. 2 + 0 -> 2
export const REMOVE_ADDING_ZERO = defineRuleString('#a + 0', '#a')

// e.g. 0 + 2 -> 2
export const REMOVE_ADDING_ZERO_REVERSE = defineRuleString('0 + #a', '#a')

// e.g. x ^ 1 -> x
export const REMOVE_EXPONENT_BY_ONE = defineRuleString('#a ^ 1', '#a')

// e.g. 1 ^ x -> 1
export const REMOVE_EXPONENT_BASE_ONE = defineRuleString('1 ^ #a', '1')

// e.g. x * -1 -> -x
export const REMOVE_MULTIPLYING_BY_NEGATIVE_ONE = defineRuleString('#a * -1', '-#a')

// e.g. -1 * x -> -x
export const REMOVE_MULTIPLYING_BY_NEGATIVE_ONE_REVERSE = defineRuleString('-1 * #a', '-#a')

// e.g. x * 1 -> x
export const REMOVE_MULTIPLYING_BY_ONE = defineRuleString('#a * 1', '#a')

// e.g. 1 * x -> x
export const REMOVE_MULTIPLYING_BY_ONE_REVERSE = defineRuleString('1 * #a', '#a')

// e.g. 2 - - 3 -> 2 + 3
export const RESOLVE_DOUBLE_MINUS = defineRuleString('#a - -#b', '#a + #b')

// e.g -3 * -2 -> 3 * 2
export const MULTIPLY_NEGATIVES = defineRuleString('-#a * -#b', '#a * #b')


// FRACTIONS

// e.g. (x + 1) / 2 -> x / 2 + 1 / 2
export const BREAK_UP_FRACTION =
    defineRuleString('(#a_0 + ...) / #b', '#a_0 / #b + ...')

// e.g. -2/-3 => 2/3
export const CANCEL_MINUSES = defineRuleString('-#a / -#b', '#a / #b')

// e.g. 2x/2 -> x
// CANCEL_TERMS: 'CANCEL_TERMS',

// e.g. 2/6 -> 1/3
export const SIMPLIFY_FRACTION =
    defineRuleString('#a / #b', '(#eval(#a/gcd(#a, #b)) / (#eval(#b/gcd(#a, #b))))', {a: query.isNumber, b: query.isNumber})

// e.g. 2/-3 -> -2/3
export const SIMPLIFY_SIGNS = defineRuleString('#a / -#b', '-#a / #b')


// ADDING FRACTIONS

export const COMBINE_NUMERATORS =
    defineRuleString('#a_0 / #b + ...', '(#a_0 + ...) / #b')

export const COMMON_DENOMINATOR =
    defineRuleString(
        '#a_0 / #b_0 + ...',
        '(#a_0 * #eval(lcm(#b_0, ...) / #b_0)) / (#b_0 * #eval(lcm(#b_0, ...) / #b_0)) + ...'
    )

// MULTIPLYING FRACTIONS

// e.g. 1/2 * 2/3 -> 2/3
export const MULTIPLY_FRACTIONS = defineRuleString('#a / #b * #c / #d', '(#a * #c) / (#b * #d)')

// DIVISION

// e.g. 2/3/4 -> 2/(3*4)
export const SIMPLIFY_DIVISION = defineRuleString('#a / #b / #c', '#a / (#b * #c)')

// e.g. x/(2/3) -> x * 3/2
export const MULTIPLY_BY_INVERSE = defineRuleString('#a / (#b / #c)', '#a * (#c / #b)')

// ABSOLUTE
// e.g. |-3| -> 3
export const ABSOLUTE_VALUE = defineRuleString('|-#a|', '#a')

// ROOT

// assumes that the exponent is a constant value
// TODO: handle cases like nthRoot('x^2y', 2)
export const CANCEL_EXPONENT = defineRule(
    (node) => {
        //console.log(node);
        let isNthRoot = false
        let validRadicand = false
        if (query.isApply(node)){
            isNthRoot = query.isIdentifier(node.op)
                && node.op.name == 'nthRoot'
            validRadicand = query.isMul(node.args[0]) ||
                query.isPow(node.args[0])
        }
        //console.log(isNthRoot)
        //console.log(validRadicand)
        return (isNthRoot && validRadicand) ? {node} : null
    },
    (node) => {
        //console.log(node);
        const radicand = node.args[0]
        const variable = radicand.args[0]
        const exponent = radicand.args[1]
        const index = node.args[1]
        
        let result;

        // case of single polynomial term: x^2, a^3 
        if (query.isPow(radicand)) {

            // simplify exponent / index
            // e.g nthRoot(x^2, 4) -> 2/4 -> 1/2
            const newRoot = applyRule(SIMPLIFY_FRACTION,
                                      build.applyNode('div', [exponent, index]))
            let numerator = newRoot.args[0]
            let denominator = newRoot.args[1]

            // Case #1: numerator > denominator && denominator = 1
            // e.g nthRoot(x^4, 2) -> 4/2 -> 2/1 -> x^2
            // Case #2: numerator < denominator ||
            // numerator > denominator && denominator != 1, return nthRoot
            // e.g nthRoot(x^2, 4) -> 2/4 -> 1/2 -> nthRoot(x^1, 2)
            // Case #3: numerator == denominator
            // e.g nthRoot(x^2, 2) -> 2/2 -> x^1

            if (query.getValue(numerator) > query.getValue(denominator)
                &&  query.getValue(denominator) == 1){
                result = build.applyNode('pow', [variable, numerator])
            } else if (query.getValue(numerator) === query.getValue(denominator)){
                result = build.applyNode('pow', [variable, build.numberNode(1)])
            } else {
                result = build.applyNode (
                    {type: 'Identifier', name: 'nthRoot'},
                    [build.applyNode('pow', [variable, numerator]), denominator]
                )
            }
            return result
        } else if (query.isApply(node)) {
            //console.log(node);
        }
    }
)

// e.g. nthRoot(2, 2) * nthRoot(3, 2) -> nthRoot(2 * 3, 2)
export const COMBINE_UNDER_ROOT = defineRuleString('nthRoot(#a, #c) * nthRoot(#b, #c)', 'nthRoot(#a * #b, #c)')

// e.g. 2 * 2 * 2 -> 2 ^ 3
export const CONVERT_MULTIPLICATION_TO_EXPONENT = defineRuleString('#a^#b_0 * ...', '#a^#eval(#b_0 + ...)', {a: query.isNumber, b: query.isNumber})

// e.g. nthRoot(2 * x) -> nthRoot(2) * nthRoot(x)
export const DISTRIBUTE_NTH_ROOT = defineRule(
    (node) => {
        let isNthRoot = false
        let validRadicand = false
        if (query.isApply(node)){
            isNthRoot = query.isIdentifier(node.op)
                && node.op.name == 'nthRoot'
            validRadicand = query.isMul(node.args[0])
        }
        return (isNthRoot && validRadicand) ? {node} : null
    },

    (node) => {
        const radicand = node.args[0];
        const result = build.applyNode(
            'mul',
            radicand.args.map(arg => {
                return build.applyNode(
                    {type: 'Identifier', name: 'nthRoot'},
                    [arg]
                )
            })
        )
        return result
    }
)

// e.g. nthRoot(4) * nthRoot(x^2) -> 2 * x
export const EVALUATE_DISTRIBUTED_NTH_ROOT = defineRule(
    (node) => {
        
    },

    (node) => {
        
    }
)

// e.g nthRoot(4) -> 2
export const NTH_ROOT_VALUE = defineRuleString('nthRoot(#a)', '#eval(#a^(1/2))', {a: query.isNumber})

// MULTIPLYING POLYNOMIALS

// e.g. x^2 * x -> x^2 * x^1
// export const ADD_EXPONENT_OF_ONE = ...


// EXPONENT RULES

// e.g. x^5 * x^3 -> x^(5 + 3)
export const PRODUCT_RULE = defineRuleString('#a^#b_0 * ...', '#a^(#b_0 + ...)')

// e.g. x^5 / x^3 -> x^(5 - 3)
export const QUOTIENT_RULE = defineRuleString('#a^#p / #a^#q', '#a^(#p - #q)')

// e.g. (a * b)^x -> a^x * b^x
export const POWER_OF_A_PRODUCT =
    defineRuleString('(#a_0 * ...)^#b', '#a_0^#b * ...')

// e.g. (1 / 2)^n -> 1^n / 2^n
export const POWER_OF_A_QUOTIENT =
    defineRuleString('(#a / #b)^#n', '#a^#n / #b^#n')

// TODO: a^-p -> 1 / a^p (and the reverse)
// TODO: a^(p/q) -> (a^1/q)^p


// DISTRIBUTION

// e.g. 2 * (x + 1) -> 2 * x + 2 * 1
export const DISTRIBUTE =
    defineRuleString('#a * (#b_0 + ...)', '#a * #b_0 + ...')

// e.g. (x + 1) * 2 -> x * 2 + 1 * 2
export const DISTRIBUTE_RIGHT =
    defineRuleString('(#b_0 + ...) * #a', '#b_0 * #a + ...')

// e.g. -(x + 1) -> -x + -1
export const DISTRIBUTE_NEGATIVE_ONE =
    defineRuleString('-(#a_0 + ...)', '-1 * #a_0 + ...')


// COLLECT AND COMBINE
export {default as COLLECT_LIKE_TERMS} from './rules/collect-like-terms'

export {ADD_POLYNOMIAL_TERMS} from './rules/collect-like-terms'

// SOLVING FOR A VARIABLE

// e.g. x - 3 = 2 -> x - 3 + 3 = 2 + 3
export const ADD_TO_BOTH_SIDES =
    defineRuleString('#x - #a = #y', '#x - #a + #a = #y + #a')

// e.g. x + 3 = 2 -> x + 3 - 3 = 2 - 3
export const SUBTRACT_FROM_BOTH_SIDES =
    defineRuleString('#x + #a = #b', '#x + #a - #a = #b - #a')

// e.g. x/2 = 1 -> (x/2) * 2 = 1 * 2
export const MULTIPLY_BOTH_SIDES =
    defineRuleString('#x/#a = #b' , '#x/#a * #a = #b * #a')

// e.g. 2x = 1 -> (2x)/2 = 1/2
export const DIVIDE_FROM_BOTH_SIDES =
    defineRuleString('#a #x = #b', '(#a #x) / #a = #b / #a')

// e.g. (2/3)x = 1 -> (2/3)x * (3/2) = 1 * (3/2)
export const MULTIPLY_BOTH_SIDES_BY_INVERSE_FRACTION =
    defineRuleString('(#a/#b) * #x = #c', '(#a/#b) * #x * (#b/#a) = #c * (#b/#a)')

// e.g. -x = 2 -> -1 * -x = -1 * 2
export const MULTIPLY_BOTH_SIDES_BY_NEGATIVE_ONE =
    defineRuleString('-#a = #b', '-1 * -#a = -1 * #b')

// e.g. 2 = x -> x = 2
export const SWAP_SIDES =
    defineRuleString('#a = #b', '#b = #a')

// TODO: figure out how to handle these
// // e.g. x + 2 - 1 = 3 -> x + 1 = 3
// SIMPLIFY_LEFT_SIDE: 'SIMPLIFY_LEFT_SIDE',

// // e.g. x = 3 - 1 -> x = 2
// SIMPLIFY_RIGHT_SIDE: 'SIMPLIFY_RIGHT_SIDE',
