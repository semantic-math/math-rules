import {parse, print} from 'math-parser'
import evaluate from 'math-evaluator'
import {build, query} from 'math-nodes'
import {traverse, replace} from 'math-traverse'

import {defineRule, definePatternRule, canApplyRule, applyRule} from './matcher'
import {isPolynomialTerm, getCoefficient, getVariableFactors, getCoefficientsAndConstants} from './rules/collect-like-terms.js'
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
// SIMPLIFY_FRACTION: 'SIMPLIFY_FRACTION',

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


// MULTIPLYING POLYNOMIALS

// e.g. 6x y z -> 6 (x^1y^1z^1) (where x, y, z are
// separate identifiers)

export const ADD_EXPONENT_OF_ONE_HELPER = defineRule(
    (node) => {
        const hasConstantVariable = query.isMul(node) && node.args.some(query.isIdentifier)

        return (hasConstantVariable) ? {node} : null
    },

    (node) => {
        const result = build.applyNode(
            'mul',
            node.args.map(arg => {
                if (query.isIdentifier(arg)){
                    return build.applyNode('pow', [arg, build.numberNode(1)])
                } else {
                    return arg
                }
            }), {implicit: node.implicit}
        )
        return result
    }
)

// TODO: replace with #35
// e.g. x^2 * x -> x^2 * x^1
export const ADD_EXPONENT_OF_ONE = defineRule(
    (node) => {
        let isMulOfPolynomials = false

        if (query.isMul(node)) {
            const {constants, coefficientMap} = getCoefficientsAndConstants(node)
            isMulOfPolynomials = Object.keys(coefficientMap).length > 1
                || Object.keys(coefficientMap)
                .some(key => coefficientMap[key].length > 1)
        }

        return (isMulOfPolynomials && !node.implicit) ? {node} : null
    },

    (node) => {
        const result = build.applyNode(
            'mul',
            node.args.map(arg => {
                if (canApplyRule(ADD_EXPONENT_OF_ONE_HELPER, arg)) {
                    return applyRule(ADD_EXPONENT_OF_ONE_HELPER, arg)
                } else if (query.isIdentifier(arg)) {
                    return build.applyNode('pow', [arg, build.numberNode(1)])
                } else {
                    return arg
                }
            })
        )
        return result
    }
)

// EXPONENT RULES

// e.g. x^5 * x^3 -> x^(5 + 3)
export const PRODUCT_RULE = defineRuleString('#a^#b_0 * ...', '#a^(#b_0 + ...)')

// e.g. x^5 / x^3 -> x^(5 - 3)
export const QUOTIENT_RULE = defineRuleString('#a^#p / #a^#q', '#a^(#p - #q)')

// e.g. 3x^2 * 2x^2 -> (3 * 2)(x^2 * x^2)
export const MULTIPLY_COEFFICIENTS = defineRule(
    (node) => {
        return canApplyRule(ADD_EXPONENT_OF_ONE, node) ? {node} : null
    },
    (node) => {
        const terms = []
        const coeffs = []
        traverse(node, {
            enter(node) {
                if(query.isPow(node)){
                    terms.push(node)
                }
            }
        })
        node.args.forEach(arg =>
                          coeffs.push(getCoefficient(arg)))

        const newCoeff = build.applyNode(
            'mul',
            coeffs
        )
        const newVariable = build.applyNode(
            'mul',
            terms
        )
        const result = build.applyNode(
            'mul',
            [newCoeff, newVariable],
            {implicit: true}
        )
        return result
    }
)

// e.g. 3x^3 * y^2 -> 3 (x^3 y^2)
export const MULTIPLY_POLYNOMIAL_TERMS = defineRule(
    (node) => {
        return canApplyRule(MULTIPLY_COEFFICIENTS, node) ? {node} : null
    },

    (node) => {
        const terms = {}
        traverse(node, {
            enter(node) {
                if(query.isPow(node)){
                    const variable = print(node.args[0])
                    const exponent = node.args[1]
                    if(!(variable in terms)){
                        terms[variable] = [query.getValue(exponent)]
                    } else {
                        terms[variable].push(query.getValue(exponent))
                    }
                }
            }
        })

        let newVariable

        if(Object.keys(terms).length > 1) {
            newVariable = build.applyNode(
                'mul',
                Object.keys(terms).map(key => {
                    const exponent = terms[key].reduce((a,b) => a + b)
                    const expression = `${key}^${exponent}`
                    return parse(expression)
                }), {implicit: true}
            )
        } else {
            newVariable = Object.keys(terms).map(key => {
                const exponent = terms[key].reduce((a,b) => a + b)
                const expression = `${key}^${exponent}`
                return parse(expression)
            })
            newVariable = newVariable[0]
        }

        let newCoeff = 1
        node.args.forEach(arg => newCoeff *= query.getValue(getCoefficient(arg)))

        const newCoeffNode = build.numberNode(newCoeff)

        const result = build.applyNode(
            'mul',
            [newCoeffNode, newVariable],
            {implicit: true}
        )
        return result
    }
)

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

export const FRACTIONAL_POLYNOMIALS = defineRule(
    (node) => {
        let isFractionalPolynomial = false
        if (query.isMul(node)){
            const fraction = node.args[1]
            isFractionalPolynomial = query.isNumber(node.args[0])
                && query.isDiv(fraction)
                && isPolynomialTerm(fraction.args[0])
                && query.isNumber(fraction.args[1])
        }
        return isFractionalPolynomial ? {node} : null
    },

    (node) => {
        const fraction = node.args[1]
        const newFraction = build.applyNode(
            'div',
            [node.args[0], fraction.args[1]]
        )

        const result = build.applyNode(
            'mul',
            [newFraction, fraction.args[0]]
            , {implicit: true}
        )
        return result
    }
)

// TODO: Change fractional polynomials to use this
//export const FRACTIONAL_POLYNOMIALS = defineRuleString(
  //  '#a #b/#c', '#a / #c #b'
//)

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
