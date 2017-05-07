import {parse, print} from 'math-parser'

import {defineRule, matchNode, populatePattern} from '../matcher'
import {applyNode, numberNode, isNumber, isAdd, isMul, isNeg, isPow, isIdentifier, getValue, clone} from '../nodes'

const populatePatternString = (pattern, placeholders) => populatePattern(parse(pattern), placeholders)

const pattern = parse('#a #x')
const constantPattern = parse('#a')

const isPolynomial = (node) => {
    return isAdd(node) && node.args.every(isPolynomialTerm)
}

const isPolynomialTerm = (node) => {
    if (isNumber(node)) {
        return true
    } else if (isIdentifier(node)) {
        return true
    } else if (isPow(node)) {
        const [base, exponent] = node.args
        return isIdentifier(base) && isPolynomialTerm(exponent)
    } else if (isNeg(node)) {
        return isPolynomialTerm(node.args[0])
    } else if (isMul(node)) {
        return node.args.every(isPolynomialTerm)
    }
}

const getCoefficient = (node) => {
    if (isNumber(node)) {
        return node
    } else if (isIdentifier(node) || isPow(node)) {
        return numberNode(1)
    } else if (isNeg(node)) {
        const result = applyNode('neg', [getCoefficient(node.args[0])])
        result.wasMinus = node.wasMinus
        return result
    } else if (isMul(node)) {
        const numbers = node.args.filter(isNumber)
        if (numbers.length > 1) {
            return applyNode('mul', numbers)
        } else if (numbers.length > 0) {
            return numbers[0]
        } else {
            return numberNode(1)
        }
    }
}

const getVariable = (node) => {
    if (isIdentifier(node) || isPow(node)) {
        return node
    } else if (isMul(node)) {
        const variables = node.args.filter(
            node => isIdentifier(node) || isPow(node))

        if (variables.length > 1) {
            return applyNode('mul', variables, null, {implicit: true})
        } else {
            return variables[0]
        }
    } else if (isNeg(node)) {
        return getVariable(node.args[0])
    }
}

const getCoefficientsAndConstants = (node) => {
    const coefficientMap = {}
    const constants = []

    node.args.forEach(arg => {
        if (isNumber(arg)) {
            constants.push(arg)
        } else {
            const variable = getVariable(arg)
            const coefficient = getCoefficient(arg)

            // TODO: sort the factors
            const key = print(variable)

            if (!(key in coefficientMap)) {
                coefficientMap[key] = []
            }

            coefficientMap[key].push(coefficient)
        }
    })

    return {coefficientMap, constants}
}

const rule = defineRule(
    (node) => {
        let hasLikeTerms = false
        if (isPolynomial(node)) {
            const {constants, coefficientMap} = getCoefficientsAndConstants(node)
            hasLikeTerms = constants.length > 1 ||
                Object.keys(coefficientMap)
                    .some(key => coefficientMap[key].length > 1)
        }
        return hasLikeTerms ? node : null
    },

    (node) => {
        const {constants, coefficientMap} = getCoefficientsAndConstants(node)

        const result = applyNode(
            'add',
            Object.keys(coefficientMap).sort().map(key => {
                const coeffs = coefficientMap[key]
                const variable = parse(key)

                const terms = coeffs.map(coeff => {
                    if (getValue(coeff) === 1) {
                        return clone(variable)
                    } else if (getValue(coeff) === -1) {
                        return applyNode('neg', [clone(variable)],
                            null, {wasMinus: coeff.wasMinus})
                    } else {
                        // TODO: Create helper functions to make dealing with
                        // negatives easier.
                        // TODO: Create a function to flatten multiplication
                        // and addition.
                        if (coeff.wasMinus) {
                            const variables = isMul(variable)
                                ? variable.args.map(clone)
                                : [clone(variable)]
                            return applyNode('neg', [
                                applyNode('mul', [
                                    clone(coeff.args[0]),
                                    ...variables,
                                ], null, {implicit: true}),
                            ], null, {wasMinus: true})
                        } else {
                            const variables = isMul(variable)
                                ? variable.args.map(clone)
                                : [clone(variable)]
                            return applyNode('mul', [
                                clone(coeff),
                                ...variables,
                            ], null, {implicit: true})
                        }
                    }
                })

                return terms.length > 1 ? applyNode('add', terms) : terms[0]
            }))

        if (constants.length > 1) {
            result.args.push(applyNode('add', constants))
        } else if (constants.length > 0) {
            result.args.push(constants[0])
        }

        return result
    }
)

export default rule
