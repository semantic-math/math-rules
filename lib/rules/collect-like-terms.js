import {parse, print} from 'math-parser'
import {build, query} from 'math-nodes'

import {defineRule, populatePattern} from '../matcher'

const clone = node => JSON.parse(JSON.stringify(node))
const populatePatternString = (pattern, placeholders) => populatePattern(parse(pattern), placeholders)

const pattern = parse('#a #x')
const constantPattern = parse('#a')

const isPolynomial = (node) => {
    return query.isAdd(node) && node.args.every(isPolynomialTerm)
}

const isPolynomialTerm = (node) => {
    if (query.isNumber(node)) {
        return true
    } else if (query.isIdentifier(node)) {
        return true
    } else if (query.isPow(node)) {
        const [base, exponent] = node.args
        return query.isIdentifier(base) && isPolynomialTerm(exponent)
    } else if (query.isNeg(node)) {
        return isPolynomialTerm(node.args[0])
    } else if (query.isMul(node)) {
        return node.args.every(isPolynomialTerm)
    }
}

const getCoefficient = (node) => {
    if (query.isNumber(node)) {
        return node
    } else if (query.isIdentifier(node) || query.isPow(node)) {
        return build.numberNode(1)
    } else if (query.isNeg(node)) {
        const result = build.applyNode('neg', [getCoefficient(node.args[0])])
        result.wasMinus = node.wasMinus
        return result
    } else if (query.isMul(node)) {
        const numbers = node.args.filter(query.isNumber)
        if (numbers.length > 1) {
            return build.applyNode('mul', numbers)
        } else if (numbers.length > 0) {
            return numbers[0]
        } else {
            return build.numberNode(1)
        }
    }
}

const getVariable = (node) => {
    if (query.isIdentifier(node) || query.isPow(node)) {
        return node
    } else if (query.isMul(node)) {
        const variables = node.args.filter(
            node => query.isIdentifier(node) || query.isPow(node))

        if (variables.length > 1) {
            return build.applyNode('mul', variables, null, {implicit: true})
        } else {
            return variables[0]
        }
    } else if (query.isNeg(node)) {
        return getVariable(node.args[0])
    }
}

const getCoefficientsAndConstants = (node) => {
    const coefficientMap = {}
    const constants = []

    node.args.forEach(arg => {
        if (query.isNumber(arg)) {
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

const COLLECT_LIKE_TERMS = defineRule(
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

        const result = build.applyNode(
            'add',
            Object.keys(coefficientMap).sort().map(key => {
                const coeffs = coefficientMap[key]
                const variable = parse(key)

                const terms = coeffs.map(coeff => {
                    if (query.getValue(coeff) === 1) {
                        return clone(variable)
                    } else if (query.getValue(coeff) === -1) {
                        return build.applyNode('neg', [clone(variable)],
                            null, {wasMinus: coeff.wasMinus})
                    } else {
                        // TODO: Create helper functions to make dealing with
                        // negatives easier.
                        // TODO: Create a function to flatten multiplication
                        // and addition.
                        if (coeff.wasMinus) {
                            const variables = query.isMul(variable)
                                ? variable.args.map(clone)
                                : [clone(variable)]
                            return build.applyNode('neg', [
                                build.applyNode('mul', [
                                    clone(coeff.args[0]),
                                    ...variables,
                                ], null, {implicit: true}),
                            ], null, {wasMinus: true})
                        } else {
                            const variables = query.isMul(variable)
                                ? variable.args.map(clone)
                                : [clone(variable)]
                            return build.applyNode('mul', [
                                clone(coeff),
                                ...variables,
                            ], null, {implicit: true})
                        }
                    }
                })

                return terms.length > 1 ? build.applyNode('add', terms) : terms[0]
            }))

        if (constants.length > 1) {
            result.args.push(build.applyNode('add', constants))
        } else if (constants.length > 0) {
            result.args.push(constants[0])
        }

        return result
    }
)

export default COLLECT_LIKE_TERMS
