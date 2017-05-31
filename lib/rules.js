import {parse, print} from 'math-parser'
import evaluate from 'math-evaluator'
import {gcd, lcm, nthRoot, primeFactorization, abs} from 'math-evaluator'
import {build, query} from 'math-nodes'
import {traverse} from 'math-traverse'

import {defineRule, definePatternRule, applyRule, canApplyRule} from './matcher'
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

export const REARRANGE_COEFF = defineRuleString('#b * #a', '#a #b', {a: query.isNumber, b: isPolynomialTerm})

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
export const SIMPLIFY_FRACTION = defineRuleString(
    '#a / #b',
    '#eval(sign(#a/#b) * |#a|/gcd(#a, #b)) / #eval(|#b|/gcd(#a, #b))',
    {a: query.isNumber, b: query.isNumber})

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

// Have a 'negatives' array which marks things as being negative or not for
// items in a variable length node.  When we're populating that variable length
// node, use the 'negatives' array to decide which items to wrap in a 'neg' node

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
// e.g. nthRoot(x^2, 4) -> nthRoot(x^1 ,2)
export const CANCEL_EXPONENT = defineRule(
    (node) => {
        let isNthRoot = false
        let validRadicand = false
        if (query.isApply(node)) {
            isNthRoot = (node.op == 'nthRoot')
            validRadicand = query.isPow(node.args[0])
        }
        return (isNthRoot && validRadicand) ? {node} : null
    },
    (node) => {
        const radicand = node.args[0]
        const variable = radicand.args[0]
        const exponent = radicand.args[1]
        let index = node.args[1]

        // simplify exponent / index
        // e.g. nthRoot(x^2, 4) -> 2/4 -> 1/2
        const newRoot = applyRule(SIMPLIFY_FRACTION,
                                  build.applyNode('div', [exponent, index]))

        let newExponent = newRoot.args[0]
        let newIndex = newRoot.args[1]
        let exponentVal = query.getValue(newExponent)
        let indexVal = query.getValue(newIndex)

        // Case #1: (numerator > denominator || numerator == -1) && denominator = 1
        // e.g nthRoot(x^4, 2) -> 4/2 -> 2/1 -> x^2
        // Case #2: numerator == denominator
        // e.g nthRoot(x^2, 2) -> 2/2 -> x^1
        // Case #3: numerator < denominator ||
        // numerator > denominator && denominator != 1, return nthRoot
        // e.g nthRoot(x^2, 4) -> 2/4 -> 1/2 -> nthRoot(x^1, 2)
        if ((exponentVal > indexVal || exponentVal == -1) && indexVal == 1) {
            return build.applyNode('pow', [variable, newExponent])
        } else if (exponentVal === indexVal) {
            return build.applyNode('pow', [variable, build.numberNode(1)])
        } else {
            return build.applyNode (
                'nthRoot',
                [build.applyNode('pow', [variable, newExponent]), newIndex]
            )
        }
    }
)

// e.g. nthRoot(2, 2) * nthRoot(3, 2) -> nthRoot(2 * 3, 2)
export const COMBINE_UNDER_ROOT = defineRuleString('nthRoot(#a_0, #b) * ...', 'nthRoot(#a_0 * ..., #b)')

// e.g. 2^1 * 2^1 * 2^3 -> 2 ^ 3
export const CONVERT_MULTIPLICATION_TO_EXPONENT = defineRuleString('#a^#b_0 * ...', '#a^#eval(#b_0 + ...)', {a: query.isNumber, b: query.isNumber})

// e.g. nthRoot(2 * x, 2) -> nthRoot(2, 2) * nthRoot(x, 2)
export const DISTRIBUTE_NTH_ROOT = defineRuleString('nthRoot(#a_0 * ..., #b)', 'nthRoot(#a_0, #b) * ...')


// TODO: #10 and #23 (`or` rules and applying multiple rules if
// multiple occurrences)
// e.g. nthRoot(4, 2) * nthRoot(x^2, 2) -> 2 * x
export const EVALUATE_DISTRIBUTED_NTH_ROOT = defineRule(
    (node) => {
        let isDistributed = query.isMul(node)
        let canEvaluate = false
        if (isDistributed) {
            canEvaluate = node.args.every(arg => canApplyRule(CANCEL_EXPONENT, arg) || canApplyRule(NTH_ROOT_VALUE, arg))
        }
        return (isDistributed && canEvaluate) ? {node} : null
    },

    (node) => {
        const result = build.applyNode(
            'mul',
            node.args.map(nthRoot => {
                const [radicand, index] = nthRoot.args
                if (query.isNumber(radicand)) {
                    return applyRule(NTH_ROOT_VALUE,
                                     build.applyNode(
                                         'nthRoot',
                                         [radicand, index]
                                     ))
                } else {
                    return applyRule(CANCEL_EXPONENT,
                                     build.applyNode(
                                         'nthRoot',
                                         [radicand, index]
                                     ))
                }
            })
        )
        return result
    }
)

// e.g. 12 -> 2 * 2 * 3
export const FACTOR_INTO_PRIME = defineRule(
    (node) => {
        return query.isNumber(node) ? {node} : null
    },

    (node) => {
        const factors = primeFactorization(query.getValue(node))
        return build.applyNode('mul', factors.map(build.numberNode))
    }
)

// e.g. nthRoot(2 * 2 * 2, 2) -> nthRoot((2 * 2) * 2, 2)
export const GROUP_TERMS_BY_ROOT = defineRule(
    (node) => {
        const canGroupTerms = canApplyRule(DISTRIBUTE_NTH_ROOT, node)
        return canGroupTerms ? {node} : null
    },

    (node) => {
        const radicand = node.args[0]
        const index = node.args[1]

        // dictionary storing the number of times a constant appears
        // e.g. 2 * 2 * 2 => {'2': 3} , 2 appears 3 times
        const count = {}
        radicand.args.forEach(arg => {
            const key = JSON.stringify(arg)
            count[key] ? count[key]++ : count[key] = 1
        })

        const flatten = arr => arr.reduce(
            (acc, val) => acc.concat(val), []
        )

        const result = build.applyNode(
            'nthRoot',
            [build.applyNode(
                'mul',
                flatten(Object.keys(count).map(key => {
                    let leftover = count[key]
                    const term = JSON.parse(key)
                    const times = query.getValue(index)

                    const args = []

                    while (leftover - times > 0) {
                        leftover -= times
                        args.push(build.applyNode('mul', Array(times).fill(term)))
                    }
                    const arg = leftover === 1
                          ? term
                          : build.applyNode('mul', Array(leftover).fill(term))
                    args.push(arg)

                    return args
                }))
            ), index]
        )

        return result
    }
)

// e.g nthRoot(9, 2) -> 3
export const NTH_ROOT_VALUE = defineRuleString('nthRoot(#a, #b)', '#eval(nthRoot(#a, #b))', {a: query.isNumber, b: query.isNumber})

// FACTOR

// TODO: add minus case
// assume monic polynomial
// TODO: add min and max to evaluate

export const FACTOR_SYMBOL = defineRuleString('#a^#b_0 + ...', '#a^#eval(min(#b_0, ...)) (#a^#eval(#b_0 - min(#b_0, ...)) + ...)', {b: query.isNumber})

// TODO: add restrictions (#c_0 divisible by 2 && #a_0 is perfect square)

// e.g. 4x^2 - 9y^2 -> (2x)^2 - (3y)^2
export const FACTOR_DIFFERENCE_OF_SQUARES_HELPER =
    defineRuleString('#a_0 #b_0^#c_0 - #d_0 #e_0^#f_0', '(#eval(nthRoot(#a_0)) #b_0^(#eval(#c_0/2)))^2 - (#eval(nthRoot(#d_0)) #e_0^(#eval(#f_0/2)))^2')

// e.g. (2x)^2 - (3y)^2 -> (2x + 3y)(2x - 3y)
export const FACTOR_DIFFERENCE_OF_SQUARES =
    defineRuleString('#a^2 - #b^2', '(#a + #b)(#a - #b)')


// TODO: use nthRoot
// TODO: handle negative terms ughghghgh

// e.g. 4x^2 + 12x + 9 -> (2x + 3)^2
export const FACTOR_PERFECT_SQUARE = defineRule(
    (node) => {
        let isQuadratic = false
        let isPerfectSquareTrinomial = false
        // trinomial is a perfect square if it satisfies the conditions that
        // a^2 + 2ab + b^2 = (a + b)^2
        // 1. First & third term are perfect squares
        // 2. Middle coefficient is 2 / -2 * (sqrt(a^2)) * (sqrt(b^2))
        if (query.isAdd(node) && node.args.length === 3) {
            const [firstTerm, secondTerm, thirdTerm] = node.args
            isQuadratic =
                query.isMul(firstTerm)
                && query.isMul(secondTerm)
                && query.isNumber(thirdTerm)
            if (isQuadratic) {
                const firstCoef = query.getValue(firstTerm.args[0])
                const firstPoly = firstTerm.args[1]
                const thirdCoef = query.getValue(thirdTerm)
                const degree = query.getValue(firstPoly.args[1])
                // Theoretical second term (should be 2 * 2 * 3 * x -> 12x in e.g.)
                const secondCoef = build.numberNode(2 * Math.sqrt(firstCoef) * Math.sqrt(thirdCoef))
                const secondPoly = degree / 2 == 1
                      ? firstPoly.args[0]
                      : build.applyNode('pow', [firstPoly.args[0], build.numberNode(degree / 2)])
                const matchSecondTerm =  build.applyNode ('mul',
                                                     [secondCoef, secondPoly]
                                                          , {implicit: true})
                console.log(secondTerm)
                console.log(matchSecondTerm)
                console.log(print(secondTerm))
                console.log(print(matchSecondTerm))
                console.log(print(secondTerm) == print(matchSecondTerm))
                // 1. Checks if coefficients are perfect squares
                // 2. Checks if leading degree is even
                // 3. Middle coefficient follows condition
                isPerfectSquareTrinomial = Number.isInteger(Math.sqrt(firstCoef))
                    && Number.isInteger(Math.sqrt(thirdCoef))
                    && degree % 2 == 0
                    && (print(secondTerm) == print(matchSecondTerm)
                        || print(secondTerm) == '-' + print(matchSecondTerm))
            }
        }
        return isPerfectSquareTrinomial ? {node} : null
    },

    (node) => {
        console.log(node)
    }
)

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

export const FRACTIONAL_POLYNOMIALS = defineRuleString('#a #b/#c', '#a / #c #b')

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
