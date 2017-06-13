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

// FACTOR

// TODO: add minus case
// assume monic polynomial
// TODO: add min and max to evaluate

// e.g. x^2 + x^5 + x^6 -> x^2(x^0 + x^3 + x^4) 
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

// TODO: handle fractional coefficients
// TODO: isPolynomialTerm should handle fractional coeffs

// e.g. 4x^2 + 12x + 9 -> (2x + 3)^2
export const FACTOR_PERFECT_SQUARE_TRINOMIALS = defineRule(
    (node) => {
        const isFactorable = canApplyRule(FACTOR_SUM_PRODUCT_RULE, node)
        if (isFactorable) {
            const result = applyRule(FACTOR_SUM_PRODUCT_RULE, node)
            return print(result.args[0]) === print(result.args[1])
                ? {node} : null
        }
    },

    (node) => {
        const result = applyRule(FACTOR_SUM_PRODUCT_RULE, node)
        return build.pow(result.args[0], build.number(2))
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
// TODO: have a rule to order terms in a polynomial in descending order

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
                const coeffs = Object.keys(coefficientMap).map(key => coefficientMap[key][0])

                const firstPoly = query.isMul(variables[0]) ? variables[0].args : [variables[0]]
                const thirdPoly =
                      variables[2]
                      ? query.isMul(variables[2])
                      ? variables[2].args
                      : [variables[2]]
                      : null

                const secondCoef = coeffs[1]
                // Second polynomial to be matched
                const firstMiddle = firstPoly.map(factor => {
                    const identifier = factor.args[0]
                    const exponent = build.number(query.getValue(factor.args[1]) / 2)
                    return build.pow(identifier, exponent)
                })

                let secondMiddle
                if (thirdPoly) {
                    secondMiddle = thirdPoly.map(factor => {
                        const identifier = factor.args[0]
                        const exponent = build.number(query.getValue(factor.args[1]) / 2)
                        return build.pow(identifier, exponent)
                    })
                }

                const matchSecondTerm =  secondMiddle
                      ? build.implicitMul(secondCoef, ...firstMiddle, ...secondMiddle)
                      : build.implicitMul(secondCoef, ...firstMiddle)

                // General conditions:
                // All degrees in 1st and 3rd term must be even
                // secondTerm = matchSecondTerm
                isFactorable =
                    firstPoly.every(term => term.args[1] % 2 == 0)
                    && thirdPoly ? thirdPoly.every(term => term.args[1] % 2 == 0) : true
                    && print(secondTerm) == print(flattenOperands(matchSecondTerm))
                return isFactorable ? {node} : null
            }
        }
    },

    (node) => {
        const {constants, coefficientMap} = getCoefficientsAndConstants(node)
        const variables = Object.keys(coefficientMap).map(key => parse(key))
        const coeffs = Object.keys(coefficientMap).map(key => coefficientMap[key][0])

        const firstCoef = query.getValue(coeffs[0])
        const firstPoly = query.isMul(variables[0]) ? variables[0].args : [variables[0]]

        const secondCoef = query.getValue(coeffs[1])

        const thirdPoly =
              variables[2]
              ? query.isMul(variables[2])
              ? variables[2].args
              : [variables[2]]
              : null

        const thirdCoef =
              thirdPoly ?
              query.getValue(coeffs[2])
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

        const result = build.implicitMul(
            ...combo.map(factor => {
                const firstFactor =
                      build.implicitMul(
                          ...[build.number(factor[0]), ...firstPoly.map(
                              factor =>
                                  {const identifier = factor.args[0]
                                   const exponent = build.number(query.getValue(factor.args[1]) / 2)
                                   return build.pow(identifier, exponent)}
                          )])
                
                const secondFactor = thirdPoly
                      ? build.implicitMul(
                          ...[build.number(Math.abs(factor[1])), ...thirdPoly.map(
                              factor =>
                                  {const identifier = factor.args[0]
                                   const exponent = build.number(query.getValue(factor.args[1]) / 2)
                                   return build.pow(identifier, exponent)}
                          )])
                      : build.number(Math.abs(factor[1]))
                return Math.sign(factor[1]) < 0
                    ? build.sub(firstFactor, secondFactor)
                    : build.add(firstFactor, secondFactor)
            })
        )

        return result
    }
)
