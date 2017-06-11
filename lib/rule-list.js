import {parse, print} from 'math-parser'
import evaluate from 'math-evaluator'
import {gcd, lcm, nthRoot, primeFactorization, abs} from 'math-evaluator'
import {build, query} from 'math-nodes'
import {traverse} from 'math-traverse'

import {defineRule, definePatternRule, applyRule, canApplyRule} from './rule'
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
        // Checks if node isNthRoot, then check if exponent can be simplified
        let canCancel = false
        if (query.isNthRoot(node)) {
            const [radicand, index] = node.args
            if (query.isPow(radicand)) {
                // get the fraction exponent, simplify it, and
                // see if the new fraction = old fraction
                const [base, exponent] = radicand.args
                if (query.isNumber(exponent) && query.isNumber(index)){
                    const oldRoot = build.div(exponent, index)
                    const newRoot = applyRule(SIMPLIFY_FRACTION, build.div(exponent, index))
                    canCancel  = print(oldRoot) != print(newRoot)
                }
            }
        }
        return (canCancel) ? {node} : null
    },
    (node) => {
        const radicand = node.args[0]
        const variable = radicand.args[0]
        const exponent = radicand.args[1]
        let index = node.args[1]

        // simplify exponent / index
        // e.g. nthRoot(x^2, 4) -> 2/4 -> 1/2
        const newRoot = applyRule(SIMPLIFY_FRACTION, build.div(exponent, index))

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
            return build.pow(variable, newExponent)
        } else if (exponentVal === indexVal) {
            return build.pow(variable, build.number(1))
        } else {
            return build.nthRoot(build.pow(variable, newExponent), newIndex)
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
            canEvaluate = node.args.some(arg => canApplyRule(CANCEL_EXPONENT, arg) || canApplyRule(NTH_ROOT_VALUE, arg))
        }
        return (isDistributed && canEvaluate) ? {node} : null
    },

    (node) => {
        const result = build.mul(
            ...node.args.map(nthRoot => {
                const [radicand, index] = nthRoot.args
                const root = build.nthRoot(radicand, index)
                if (query.isNumber(radicand)) {
                    return applyRule(NTH_ROOT_VALUE, root)
                } else if (canApplyRule(CANCEL_EXPONENT, root)){
                    return applyRule(CANCEL_EXPONENT, root)
                } else {
                    return nthRoot
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
        return build.mul(...factors.map(build.number))
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

        const result = build.nthRoot(
            build.mul(
                ...flatten(Object.keys(count).map(key => {
                    let leftover = count[key]
                    const term = JSON.parse(key)
                    const times = query.getValue(index)

                    const args = []

                    while (leftover - times > 0) {
                        leftover -= times
                        args.push(build.mul(...Array(times).fill(term)))
                    }
                    const arg = leftover === 1
                          ? term
                          : build.mul(...Array(leftover).fill(term))
                    args.push(arg)

                    return args
                }))
            ), index
        )

        return result
    }
)

// e.g nthRoot(9, 2) -> 3
export const NTH_ROOT_VALUE = defineRuleString('nthRoot(#a, #b)', '#eval(nthRoot(#a, #b))', {a: query.isNumber, b: query.isNumber})

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

// e.g. 2^-3 -> 1 / 2^3
export const NEGATIVE_EXPONENT =
    defineRuleString('#a^-#b', '1 / #a^#b')

// e.g. 2 / 3^2 -> 2 * 3^-2
export const TO_NEGATIVE_EXPONENT =
    defineRuleString('#a / #b^#c', '#a * #b^-#c')

// do we want fractions to be matched by a single identifier (#b)
// or should we match it as division (#b / #c)
// e.g. 2^(3/4) -> (2^(1/4))^3
export const FRACTIONAL_EXPONENTS =
    defineRuleString('#a^(#b / #c)', '(#a^(1/#c))^#b')

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
