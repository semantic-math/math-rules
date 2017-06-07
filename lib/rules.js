import {parse, print} from 'math-parser'
import evaluate from 'math-evaluator'
import {gcd, lcm, primeFactorization, abs} from 'math-evaluator'
import {build, query} from 'math-nodes'
import {traverse} from 'math-traverse'

import {defineRule, definePatternRule, applyRule, canApplyRule} from './matcher'
import {isPolynomialTerm, getCoefficient, getCoefficientsAndConstants, getVariableFactors, getVariableFactorName} from './rules/collect-like-terms.js'
import {clone, getRanges, flattenOperands} from './utils'

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
    defineRuleString('#a #b^#c - #d #e^#f', '(#eval(nthRoot(#a)) #b^(#eval(#c/2)))^2 - (#eval(nthRoot(#d)) #e^(#eval(#f/2)))^2')

// e.g. (2x)^2 - (3y)^2 -> (2x + 3y)(2x - 3y)
export const FACTOR_DIFFERENCE_OF_SQUARES =
    defineRuleString('#a^2 - #b^2', '(#a + #b)(#a - #b)')


export const nthRoot = (num, root = 2, precision = 12) => {
    // e.g 2^-3 = 1/(2^3)
    const inv = root < 0
    if (inv) {
        root = -root
    }

    if (root === 0) {
        throw new Error('Root must be non-zero')
    }
    if (num < 0 && (Math.abs(root) % 2 !== 1)) {
        throw new Error('Root must be odd when a is negative.')
    }

    // Edge cases zero and infinity.
    // e.g 0^3 = 0, 0^-3 = Infinity
    if (num === 0) {
        return inv ? Infinity : 0
    }

    if (num === 1) {
        return 1
    }

    if (!isFinite(num)) {
        return inv ? 0 : num
    }

    // Source: https://rosettacode.org/wiki/Nth_root#JavaScript
    const n = root
    const prec = precision

    let x = 1 // Initial guess
    for (let i = 0 ; i < prec ; i++) {
        x = 1 / n * ((n - 1) * x + (num / Math.pow(x, n - 1)))
    }

    return inv ? 1 / x : x
}

// TODO: use nthRoot
// TODO: handle fractional coefficients
// TODO: isPolynomialTerm should handle fractional coeffs
// assume that leading polynomial is positive
// assume arranged from highest to lowest degree

// e.g. 4x^2 + 12x + 9 -> (2x + 3)^2
export const FACTOR_PERFECT_SQUARE_TRINOMIALS = defineRule(
    (node) => {
        let isTrinomial = false
        let isPerfectSquareTrinomial = false
        // trinomial is a perfect square if it satisfies the conditions that
        // a^2 + 2ab + b^2 = (a + b)^2
        // 1. First & third term are perfect squares
        // 2. Middle coefficient is 2 / -2 * (sqrt(a^2)) * (sqrt(b^2))
        if (query.isAdd(node) && node.args.length === 3) {
            const [firstTerm, secondTerm, thirdTerm] = node.args

            isTrinomial =
                isPolynomialTerm(firstTerm)
                && isPolynomialTerm(secondTerm)
                && (query.isNumber(thirdTerm) || isPolynomialTerm(thirdTerm) || canApplyRule(CANCEL_EXPONENT, parse(`nthRoot(${print(thirdTerm)})`)))
            if (isTrinomial) {
                const firstCoef = query.getValue(firstTerm.args[0])
                const firstPoly = firstTerm.args[1]
                const firstDegree = query.getValue(firstPoly.args[1])

                // not sure why a number is a polynomial term
                // 3 cases
                // thirdTerm can either be 9 (constant), 9y^2 (polynomial), or
                // (9/y)^2 (a variable constant)
                const thirdCoef = isPolynomialTerm(thirdTerm) && !query.isNumber(thirdTerm)
                      ? query.getValue(thirdTerm.args[0])
                      : query.isPow(thirdTerm)
                      ? thirdTerm.args[0]
                      : query.getValue(thirdTerm)

                const thirdPoly = isPolynomialTerm(thirdTerm) && !query.isNumber(thirdTerm)
                      ? thirdTerm.args[1]
                      : null

                const thirdDegree = thirdPoly
                      ? query.getValue(thirdPoly.args[1])
                      : query.isPow(thirdTerm)
                      ? query.getValue(thirdTerm.args[1])
                      : null

                // Theoretical second term (should be 2 * 2 * 3 * x -> 12x in e.g.)
                const secondCoef = build.numberNode(2 * nthRoot(firstCoef * thirdCoef, 2))
                const firstMiddle = firstDegree / 2 == 1
                      ? firstPoly.args[0]
                      : build.applyNode('pow', [firstPoly.args[0], build.numberNode(firstDegree / 2)])

                let secondMiddle
                if (thirdPoly) {
                    secondMiddle = thirdDegree / 2 == 1
                        ? thirdPoly.args[0]
                        : build.applyNode('pow', [thirdPoly.args[0], build.numberNode(thirdDegree / 2)])
                }

                const secondPoly = secondMiddle
                      ? build.applyNode('mul', [firstMiddle, secondMiddle], {implicit: true})
                      : firstMiddle

                const matchSecondTerm =  build.applyNode ('mul',
                                                     [secondCoef, secondPoly]
                                                          , {implicit: true})

                // 1. Checks if coefficients are perfect squares
                // 2. Checks if leading degree is even
                // 3. Middle coefficient follows condition
                isPerfectSquareTrinomial = Number.isInteger(nthRoot(firstCoef, 2))
                    && Number.isInteger(nthRoot(thirdCoef, 2))
                    && firstDegree % 2 == 0
                    && thirdDegree ? thirdDegree % 2 == 0 : true
                    && (print(secondTerm) == print(flattenOperands(matchSecondTerm))
                        || print(secondTerm) == '-' + print(flattenOperands(matchSecondTerm)))
            }
        }
        return isPerfectSquareTrinomial ? {node} : null
    },

    (node) => {
        const [firstTerm, secondTerm, thirdTerm] = node.args
        const firstCoef = query.getValue(firstTerm.args[0])
        const firstPoly = firstTerm.args[1]
        const firstDegree = query.getValue(firstPoly.args[1])       
        const thirdCoef = isPolynomialTerm(thirdTerm) && !query.isNumber(thirdTerm)
              ? query.getValue(getCoefficient(thirdTerm))
              : query.getValue(thirdTerm)

        const thirdPoly = isPolynomialTerm(thirdTerm) && !query.isNumber(thirdTerm)
              ? thirdTerm.args[1]
              : null
        const thirdDegree = thirdPoly ? query.getValue(thirdPoly.args[1]) : null

        const firstFactor = parse(`${Math.sqrt(firstCoef)} ${getVariableFactorName(firstPoly)}^${firstDegree/2}`)
        const secondFactor = thirdPoly
              ? parse(`${Math.sqrt(thirdCoef)} ${getVariableFactorName(thirdPoly)}^${thirdDegree/2}`)
              : build.numberNode(Math.sqrt(query.getValue(thirdTerm)))

        const result = query.isNeg(secondTerm)
              ? build.pow(build.sub(firstFactor, secondFactor), build.numberNode(2))
              : build.pow(build.add(firstFactor, secondFactor), build.numberNode(2))
        return result
    }
)

function getFactors(num){
    var factors = []

    for(var i = 1; i <= Math.sqrt(num); i++){
        if(Number.isInteger(num/i)){
            factors.push([i, num/i])
        }
    }

    return factors
}

// TODO: handle case when exponent is a polynomial (x^b^4)
// e.g. 12x^2 + 17x + 6 -> (3 x^1 + 2) (4 x^1 + 3)
export const FACTOR_SUM_PRODUCT_RULE = defineRule(
    (node) => {
        if (query.isAdd(node) && node.args.length === 3) {
            const [firstTerm, secondTerm, thirdTerm] = node.args

            // First two terms should be polynomials
            // Third term is either number or polynomial
            const isTrinomial =
                  isPolynomialTerm(firstTerm)
                  && isPolynomialTerm(secondTerm)
                  && (query.isNumber(thirdTerm) || isPolynomialTerm(thirdTerm))

            if (isTrinomial) {
                let isFactorable = false
                const {constants, coefficientMap} = getCoefficientsAndConstants(node)
                const variables = Object.keys(coefficientMap).map(key => parse(key))
                const coefficients = Object.keys(coefficientMap).map(key => {return coefficientMap[key]})

                const firstPoly = query.isMul(variables[0]) ? variables[0].args : [variables[0]]
                const thirdPoly =
                      variables[2]
                      ? query.isMul(variables[2])
                      ? variables[2].args
                      : [variables[2]]
                      : null

                const secondCoef = coefficients[1][0]
                // Second polynomial to be matched
                const firstMiddle = firstPoly.map(term => {
                    const identifier = term.args[0]
                    const exponent = build.number(query.getValue(term.args[1]) / 2)
                    return build.applyNode('pow', [identifier, exponent])
                })
                
                let secondMiddle 
                if (thirdPoly) {
                    secondMiddle = thirdPoly.map(term => {
                        const identifier = term.args[0]
                        const exponent = build.number(query.getValue(term.args[1]) / 2)
                        return build.applyNode('pow', [identifier, exponent])
                    })
                }

                const matchSecondTerm =  secondMiddle
                      ? build.applyNode ('mul',
                                         [secondCoef, ...firstMiddle, ...secondMiddle]
                                         , {implicit: true})
                      : build.applyNode ('mul',
                                         [secondCoef, ...firstMiddle]
                                         , {implicit: true})

                // General conditions:
                // All degrees in 1st and 3rd term must be even
                // secondTerm = matchSecondTerm
                isFactorable = 
                    firstPoly.forEach(term => {return term.args[1] % 2 == 0})
                    && thirdPoly ? thirdPoly.forEach(term => {return term.args[1] % 2 == 0}) : true
                    && print(secondTerm) == print(flattenOperands(matchSecondTerm))
                return isFactorable ? {node} : null
            }
        }
    },
    
    (node) => {
        const {constants, coefficientMap} = getCoefficientsAndConstants(node)
        const variables = Object.keys(coefficientMap).map(key => parse(key))
        const coefficients = Object.keys(coefficientMap).map(key => {return coefficientMap[key]})

        const firstCoef = query.getValue(coefficients[0][0])
        const firstPoly = query.isMul(variables[0]) ? variables[0].args : [variables[0]]

        const secondCoef = query.getValue(coefficients[1][0])
        
        const thirdPoly =
              variables[2]
              ? query.isMul(variables[2])
              ? variables[2].args
              : [variables[2]]
              : null

        const thirdCoef =
              thirdPoly ?
              query.getValue(coefficients[2][0])
              : constants[0]
              ? query.getValue(constants[0])
              : null

        const firstFactors = getFactors(firstCoef)
        const thirdFactors = getFactors(Math.abs(thirdCoef))

        let combo

        for (var i in firstFactors){
            for (var j in thirdFactors) {
                const l1 = firstFactors[i]
                const l2 = thirdFactors[j]
                // both positive
                let one = l1[0] * l2[1] + l1[1] * l2[0]
                let two = l1[0] * l2[0] + l1[1] * l2[1]
                // both negative
                let three = l1[0] * -l2[1] + l1[1] * -l2[0]
                let four = l1[0] * -l2[0] + l1[1] * -l2[1]
                // l2[0] is negative and l2[1] is positive
                let five = l1[0] * l2[1] + l1[1] * -l2[0]
                let six = l1[0] * -l2[0] + l1[1] * l2[1]
                // l2[0] is positive and l2[1] is negative 
                let seven = l1[0] * -l2[1] + l1[1] * l2[0]
                let eight = l1[0] * l2[0] + l1[1] * -l2[1]

                if (one == secondCoef && l2[0] * l2[1] == thirdCoef){
                    combo = [[l1[0],l2[0]],[l1[1],l2[1]]]
                } else if (two == secondCoef && l2[0] * l2[1] == thirdCoef){
                    combo = [[l1[0],l2[1]],[l1[1],l2[0]]]
                } else if (three == secondCoef && -l2[0] * -l2[1] == thirdCoef){
                    combo = [[l1[0],-l2[0]],[l1[1],-l2[1]]]
                } else if (four == secondCoef && -l2[0] * -l2[1] == thirdCoef){
                    combo = [[l1[0],-l2[1]],[l1[1],-l2[0]]]
                } else if (five == secondCoef && -l2[0] * l2[1] == thirdCoef){
                    combo = [[l1[0],-l2[0]],[l1[1],l2[1]]]
                } else if (six == secondCoef && -l2[0] * l2[1] == thirdCoef){
                    combo = [[l1[0],l2[1]],[l1[1],-l2[0]]]
                } else if (seven == secondCoef && l2[0] * -l2[1] == thirdCoef){
                    combo = [[l1[0],l2[0]],[l1[1],-l2[1]]]
                } else if (eight == secondCoef && l2[0] * -l2[1] == thirdCoef){
                    combo = [[l1[0],-l2[1]],[l1[1],l2[0]]]
                } else {
                    combo = []
                }
            }
        }
        if (combo == []) {
            throw new Error('cannot factor polynomial')
        }

        const result = build.applyNode
        ('mul',
         combo.map(factor => {
             const firstFactor = 
                   build.apply('mul',
                               [build.number(factor[0]),
                                ...firstPoly.map(
                                    term =>
                                        {const identifier = term.args[0]
                                         const exponent = build.numberNode(query.getValue(term.args[1]) / 2)
                                         return build.apply('pow', [identifier, exponent])}
                                )], {implicit: true})
             
             const secondFactor = thirdPoly
                   ? build.apply('mul',
                                 [build.number(Math.abs(factor[1])),
                                  ...thirdPoly.map(
                                      term =>
                                          {const identifier = term.args[0]
                                           const exponent = build.numberNode(query.getValue(term.args[1]) / 2)
                                           return build.apply('pow', [identifier, exponent])}
                                  )], {implicit: true})
                   : build.number(Math.abs(factor[1]))
             return Math.sign(factor[1]) < 0
                 ? build.sub(firstFactor, secondFactor)
                 : build.add(firstFactor, secondFactor)
         }),
         {implicit: true}
        )

        return result
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
