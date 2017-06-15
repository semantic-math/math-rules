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
/*
export const COMMON_DENOMINATOR =
    defineRuleString(
        '#a_0 / #b_0 + ...',
        '(#a_0 * #eval(lcm(#b_0, ...) / #b_0)) / (#b_0 * #eval(lcm(#b_0, ...) / #b_0)) + ...'
    )
*/

// Finds common denominator in any scenario

// TODO: return the original expression if the denominators are already
// the same?

// e.g. 2/6 + 1/4 -> (2 * 2) / (6 * 2) + (1 * 3) / (4 * 3)
// e.g. 2/(3 + x) + 2/3 -> (2 * 3)/ (3 * (3 + x)) + 2 * (3 + x) / (3 * (3 + x))
export const COMMON_DENOMINATOR = defineRule(
    (node) => {
        if (query.isAdd(node)) {
            const terms = node.args
            // checks if at least one of the terms is a fraction
            const hasFraction = terms.some(term => query.isDiv(term))

            let sameDenom
            // rule cannot apply if all of the terms are fractions
            // and they all have the same denominator
            if (terms.every(term => query.isDiv(term))) {
                const denom = terms[0].args[1]
                sameDenom = terms.every(term => print(term.args[1]) == print(denom))
            }

            return hasFraction && !sameDenom ? {node} : null
        }
    },

    (node) => {
        const terms = node.args
        // an array storing the index where fraction is negative
        const negatives = terms.map(term => query.isNeg(term))

        // get numerators and denominators of all fractions
        let nums = terms.map(term => query.isNeg(term)
                             ? term.args[0].args[0]
                             : term.args[0])
        let denoms = terms.map(term => query.isNeg(term)
                               ? term.args[0].args[1]
                               : term.args[1])
        let newDenoms
        let newNumerators

        /*
          If all denoms are numbers, the new denom is
          the [denom * (LCM / denom)] and the new numerators
          is [num * (LCM / denom)]

          Else the new denom is the product of all the terms
          and the new numerator is [num * all other denoms]
        */
        if(denoms.every(denom => query.isNumber(denom))) {
            denoms = denoms.map(denom => query.getValue(denom))
            const LCM = lcm(...denoms)
            newDenoms = denoms.map(
                denom => build.mul(build.number(denom),
                                   build.number(LCM / denom)))
            newNumerators = nums.map(
                (num, i) => build.mul(num,
                                      build.number(LCM / denoms[i])))
        } else {
            newDenoms = build.mul(...denoms)
            newNumerators = nums.map(
                (num, i) => build.mul(num, ...denoms.filter(e => e != denoms[i])))
        }

        /*
          The newDenoms variable is an array when all the denoms
          are numbers because all the newDenoms are different.
        */
        const result = Array.isArray(newDenoms)
              ? build.add(...newDenoms.map(
                  (den, i) => negatives[i]
                      ? build.neg(build.div(newNumerators[i], den), {wasMinus: true})
                      : build.div(newNumerators[i], den)))
              : build.add(...newNumerators.map(
                  (num, i) => negatives[i]
                      ? build.neg(build.div(num, newDenoms), {wasMinus: true})
                      : build.div(num, newDenoms)))

        return result
    }
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
