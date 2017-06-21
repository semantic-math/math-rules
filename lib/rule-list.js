import {parse, print} from 'math-parser'
import evaluate from 'math-evaluator'
import {gcd, lcm, nthRoot, primeFactorization, abs} from 'math-evaluator'
import {build, query} from 'math-nodes'
import {traverse} from 'math-traverse'

import {defineRule, definePatternRule, applyRule, canApplyRule} from './rule'
import {isPolynomialTerm, getCoefficient, getVariableFactors, isPolynomial, getCoefficientsAndConstants, isImplicit} from './rules/collect-like-terms.js'
import {clone, getRanges, flattenOperands, removeUnnecessaryParentheses} from './utils'

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

// e.g. x * 5 -> 5 x
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

// e.g. 2/6 -> 1/3
export const SIMPLIFY_FRACTION = defineRuleString(
    '#a / #b',
    '#eval(sign(#a/#b) * |#a|/gcd(#a, #b)) / #eval(|#b|/gcd(#a, #b))',
    {a: query.isNumber, b: query.isNumber})

// e.g. 2/-3 -> -2/3
export const SIMPLIFY_SIGNS = defineRuleString('#a / -#b', '-#a / #b')

// e.g. 2x/3 -> 2/3 x
export const REWRITE_FRACTIONAL_POLYNOMIAL = defineRuleString(
    '#a #b / #c', '#a / #c #b', {a: query.isNumber, b: isPolynomialTerm, c: query.isNumber}
)

// ADDING FRACTIONS

// e.g. 2/5 + 2/5 -> (2 + 2)/5
export const COMBINE_NUMERATORS =
    defineRuleString('#a_0 / #b + ...', '(#a_0 + ...) / #b')


export const getNegatives = (arr) => arr.map(arg => query.isNeg(arg))

export const isFraction = (node) => query.isNeg(node)
    ? query.isDiv(node.args[0])
    : query.isDiv(node)

export const getNumerator = (node) => query.isNeg(node)
    ? node.args[0].args[0]
    : node.args[0]

export const getDenominator = (node) => query.isNeg(node)
    ? node.args[0].args[1]
    : node.args[1]

export const isDecimal = (node) => query.isNumber(node) && query.getValue(node) % 1 != 0

export const decimal_to_fraction = (node) => {
    // split up the decimal
    const [int, dec] = node.value.toString().split('.')

    // e.g. .2 -> 2/10
    const fraction = build.div(build.number(parseInt(dec)), build.number(parseInt('1' + '0'.repeat(dec.length))))

    // simplified the fraction if possible 
    const simplified = canApplyRule(SIMPLIFY_FRACTION, fraction)
          ? applyRule(SIMPLIFY_FRACTION, fraction)
          : fraction

    const newNumerator = parseInt(int) * query.getValue(simplified.args[1]) + query.getValue(simplified.args[0])
    return build.div(build.number(newNumerator), simplified.args[1])
}

// e.g. 2 + 3/2 -> 2/1 + 3/2
// e.g. 1.2 + 3/2 -> 6/5 + 3/2
export const CONVERT_TO_FRACTION = defineRule(
    (node) => {
        if (query.isAdd(node)) {
            const terms = node.args

            // only some of the terms are fractions
            const hasFraction = terms.some(term => isFraction(term))
                  && !terms.every(term => isFraction(term))
            
            return hasFraction ? {node} : null
        }
    },

    (node) => {
        let terms = node.args

        const negatives = getNegatives(terms)

        terms = terms.map(function(term) {
            let newTerm
            if (isDecimal(term)) {
                // 2.2 and -2.2
                newTerm = query.isNeg(term)
                    ? decimal_to_fraction(term.args[0])
                    : decimal_to_fraction(term)
            } else if (isPolynomialTerm(term)) {
                newTerm = query.isNeg(term)
                ? build.div(term.args[0], build.number(1))
                : build.div(term, build.number(1))
            } else {
                newTerm = query.isNeg(term)
                    ? term.args[0]
                    : term
            }
            return newTerm
        })

        const result = build.add(
            ...terms.map((term, i) => negatives[i]
                         ? build.neg(term, {wasMinus: true})
                         : term))
        return result
    }
)

// TODO: handle multivariable polynomials
// Get degree of a polynomial term
// e.g. 6x^2 -> 2
const getExponent = (node) => {
    if (query.isNumber(node)) {
        return 0
    } else if (query.isIdentifier(node) || isPolynomial(node)){
        return 1
    } else if (query.isPow(node)) {
        return query.getValue(node.args[1])
    } else if (query.isMul(node)){
        return getExponent(node.args[1])
    } else if (query.isNeg(node)) {
        const variable = node.args[0]
        return getExponent(variable.args[1])
    } else {
        return null
    }
}

// returns true if two nodes have the same base variable
// e.g. (x + 1)^1 and (x + 1)^3 , true
// e.g. x^2, (x + 1)^2, false
export const hasSameBase = (node1, node2) => {
    return print(node1) == print(node2)
        || query.isPow(node1) && print(node1.args[0]) == print(node2)
        || query.isPow(node2) && print(node1) == print(node2.args[0])
        || query.isPow(node1) && query.isPow(node2) && print(node1.args[0]) == print(node2.args[0])
}

// TODO: handle cancelling nthRoots
// e.g. (12(x+1)) / (x+1) -> 12 / 1
export const CANCEL_LIKE_TERMS = defineRule(
    (node) => {
        /*
          Must be div node and either numerator or denominator is a mul node (or both)
          Does not match in cases like ((x+1) / (x+1))
          There must also be a common factor between numerator and denominator
        */

        const canSimplify = query.isDiv(node)
              && (query.isMul(node.args[0]) || query.isMul(node.args[1]))

        if (canSimplify) {
            // checks for common factor
            let [numerator, denominator] = node.args
            let num = query.isMul(numerator) ? numerator.args : [numerator]
            let denom = query.isMul(denominator) ? denominator.args : [denominator]

            for (var i in num) {
                for (var j in denom) {
                    if (num[i] && denom[j]) {
                        const frac = build.div(num[i], denom[j])

                        if (canApplyRule(SIMPLIFY_FRACTION, frac)) {
                            return {node}
                        }

                        if (hasSameBase(num[i], denom[j])){
                            return {node}
                        }
                    }
                }
            }
        }

        return null
    },

    (node) => {
        /*
          Split up the numerator if it is a mul node.
          For each term in the numerator, if it also appears in the denominator
          cancel the exponents. If exponent is 0, remove the factor completely.
        */

        node = clone(node)

        let [numerator, denominator] = node.args
        let num = query.isMul(numerator) ? numerator.args : [numerator]
        let denom = query.isMul(denominator) ? denominator.args : [denominator]

        for (var i in num) {
            for (var j in denom) {
                // if they are defined
                if (num[i] && denom[j]) {
                    const frac = build.div(num[i], denom[j])

                    // TODO: refactor this into a helper
                    if (hasSameBase(num[i], denom[j])){
                        const newExponent = getExponent(num[i]) - getExponent(denom[j])
                        const i1 = num.indexOf(num[i])
                        const i2 = denom.indexOf(denom[j])

                        if (newExponent > 0) {
                            delete denom[i2]
                            const base = num[i].args[0]
                            num[i] = build.pow(base, build.number(newExponent))
                        } else if (newExponent == 0) {
                            delete num[i1]
                            delete denom[i2]
                        } else {
                            // remove the factor from numerator
                            delete num[i1]
                            const base = denom[j].args[0]
                            denom[j] = build.pow(base, build.number(Math.abs(newExponent)))
                        }
                    }

                    if (canApplyRule(SIMPLIFY_FRACTION, frac)) {
                        const newFraction = applyRule(SIMPLIFY_FRACTION, frac)
                        const [newNum, newDenom] = newFraction.args
                        
                        if (query.getValue(newNum) == 1 && query.getValue(newDenom) == 1) {
                            delete num[i]
                            delete denom[j]
                        } else if (query.getValue(newNum) == 1) {
                            delete num[i]
                            denom[j] = newDenom
                        } else if (query.getValue(newDenom) == 1) {
                            delete denom[j]
                            num[i] = newNum 
                        } else {
                            num[i] = newNum
                            denom[j] = newDenom
                        }
                    }
                }
            }
        }

        // Remove the empty elements in the array 
        num = num.filter(String)
        denom = denom.filter(String)
        const implicitN = isImplicit(numerator)
        const implicitD = isImplicit(denominator)

        let result

        if (denom.length == 0) {
            if (num.length == 0) {
                // when all factors cancel
                result = build.number(1)
            } else if (num.length == 1) {
                // one factor in numerator, none in denominator
                result = num[0]
            } else {
                // multiple factors in numerator, none in denominator
                result = build.apply('mul', num, {implicit:implicitN})
            }
        } else if (num.length == 0) {
            if (denom.length == 1) {
                // one factor in denominator, none in numerator
                result = build.div(build.number(1), denom[0])
            } else {
                // multiple factors in denominator, none in numerator
                result = build.div(build.number(1), build.apply('mul', denom, {implicit:implicitD}))
            }
        } else if (denom.length == 1) {
            if (num.length == 1) {
                // one factor in numerator and denominator
                result = build.div(num[0], denom[0])
            } else {
                // one factor in denominator, multiple in numerator
                result = build.div(build.apply('mul', num, {implicit:implicitN}), denom[0])
            }
        } else if (num.length == 1) {
            // one factor in numerator, multiple in denominator
            result = build.div(num[0], build.apply('mul', denom, {implicit:implicitD}))
        } else {
            // multiple factors in both numerator and denominator
            result = build.div(build.apply('mul', num, {implicit:implicitN}), build.apply('mul', denom, {implicit:implicitD}))
        }

        return result
    }
)

/*
  Lcm helper returns a dictionary with the highest power of each variable
  in the given array and the lcm of all the number nodes if any.

  Nodes can include polynomialTerms, polynomials, numbers, identifiers, etc.

  e.g. [x, (x+1)^2, x^2 y, y^2, 3, 4] -> {x: 2, x + 1: 2, y: 2} and 12
 */
export const lcm_helper = (arr, vars = {}) => {
    // key to store LCM
    vars['LCM'] = 1

    arr.forEach(function(term){
        if(query.isNumber(term)){
            vars['LCM'] = lcm(query.getValue(term), vars['LCM'])
        }

        else if (query.isIdentifier(term) || isPolynomial(term)) {
            // a, xyz, x+1, x^2+2x+1
            // exponent is one
            if(!(vars[print(term)])) {
                vars[print(term)] = 1
            }
        }

        else if (isPolynomialTerm(term)) {
            // x^2, (x^2y^1), (x+1)^2
            if (query.isPow(term)) {
                const [base, exponent] = term.args
                if (!vars[print(base)]) {
                    vars[print(base)] = query.getValue(exponent)
                } else {
                    vars[print(base)] = Math.max(query.getValue(exponent), vars[print(base)])
                }
            } else if (query.isMul(term)) {
                // recursively loop through all the terms in the mul node
                // and continue building the dictionary
                lcm_helper(term.args, vars)
            }
        }
    })
    return {vars}
}


/*
  Finds common denominator in any scenario

  e.g. 2/6 + 1/4 -> (2 * 2) / (6 * 2) + (1 * 3) / (4 * 3)
  e.g. 2/(3 + x) + 2/3 -> (2 * 3)/ (3 * (3 + x)) + 2 * (3 + x) / (3 * (3 + x))
  e.g. 3 + 2/3 -> (3 * 3) / 3 + 2 / 3
*/

export const COMMON_DENOMINATOR = defineRule(
    (node) => {
        if (query.isAdd(node)) {
            const terms = node.args
            
            /*
              Match only if at least one of the term is a fraction
              and if there are two different denoms.
            */
            const hasFraction = terms.some(term => isFraction(term))
 
            let sameDenom
            if (terms.every(term => isFraction(term))) {
                const denom = getDenominator(terms[0])

                // TODO: equals function in math-evaluator
                sameDenom = terms.every(term =>
                                        print(getDenominator(term)) == print(denom))
            }

            return hasFraction && !sameDenom ? {node} : null
        }
    },

    (node) => {
        // convert all decimals to fractions if there are any
        node = canApplyRule(CONVERT_TO_FRACTION, node)
            ? applyRule(CONVERT_TO_FRACTION, node)
            : node

        let terms = node.args

        // an array storing the index where fraction is negative
        const negatives = getNegatives(terms)

        // get numerators and denominators of all fractions
        let nums = terms.map(term => getNumerator(term))
        let denoms = terms.map(term => getDenominator(term))
        let newDenoms
        let newNumerators

        /*
          If all denoms are numbers, the new denom is
          [denom * (LCM / denom)] and the new numerators
          is [num * (LCM / denom)] for each fraction.
          e.g. 2/3 + 2/4 -> (2 * 4) / (3 * 4) + (2 * 3) / (4 * 3)

          Else: some denoms are non integers
          The new denominator is the LCM of all the polynomial and integer terms,
          take the lowest power of each variable.
          e.g. 2/3 + 2/(x+1)^2 + 2/(x+1)
          newDenom = 3 * (x+1)^2

          Note: We assume here that all arithmetic and polynomial multiplication
          has been simplified.
          e.g. 2/(2 * 2 * x * x) + 2/3 -> 2/(4 * x^2) + 2/3

          The new numerator is [old num * cancelLikeTerms(newDenom/oldDenom)]
          e.g. 2/(3+x) + 2/(2+x)
          The new numerator of the first term:
          old num: 3+x
          newDenom = (3+x)(2+x)
          cancelLikeTerms(newDenom/oldDenom) ((3+x)(2+x)) / (3+x) -> 2+x
          New first term: 2 * (2 + x)
        */

        if(denoms.every(denom => query.isNumber(denom))) {
            denoms = denoms.map(denom => query.getValue(denom))
            const LCM = lcm(...denoms)

            // remove multiplication by 1
            newDenoms = denoms.map(function(denom) {
                if (denom == 1) {
                    return build.number(LCM /denom)
                } else if (LCM / denom == 1) {
                    return build.number(denom)
                } else {
                    return build.mul(build.number(denom),
                                     build.number(LCM / denom))
                }
            })

            newNumerators = nums.map(function(num, i) {
                if (LCM / denoms[i] == 1) {
                    return num
                } else {
                    return build.mul(num, build.number(LCM / denoms[i]))
                }
            })

        } else {
            const {vars} = lcm_helper(denoms)

            const LCM = vars['LCM']
            delete vars['LCM']

            // newDenoms is the product of all terms in vars
            if (LCM == 1) {
                newDenoms = build.implicitMul(...Object.keys(vars).map(
                    base => vars[base] == 1
                        ? parse(base)
                        : build.pow(parse(base), build.number(vars[base]))
                ))
            } else {
                newDenoms = build.implicitMul(build.number(LCM), ...Object.keys(vars).map(
                    base => vars[base] == 1
                        ? parse(base)
                        : build.pow(parse(base), build.number(vars[base]))
                ))
            }

            // cancelLikeTerms(newDenom, oldDenom) = new numerator
            newNumerators = nums.map(function(num, i) {
                const frac = build.div(newDenoms, denoms[i])
                const simplified = applyRule(CANCEL_LIKE_TERMS, frac)
                if (query.isNumber(simplified)) {
                    return build.mul(num, simplified)
                } else if (isPolynomialTerm(simplified)) {
                    return removeUnnecessaryParentheses(build.implicitMul(num, build.parens(simplified)))
                } else {
                    return flattenOperands(build.implicitMul(num, simplified))
                }
            })
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
