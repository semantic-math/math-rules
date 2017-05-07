import {parse, print} from 'math-parser'

import {defineRule, matchNode, populatePattern} from '../matcher'
import {applyNode, isNumber, isAdd, isIdentifier} from '../nodes'

const populatePatternString = (pattern, placeholders) => populatePattern(parse(pattern), placeholders)

const pattern = parse('#a #x')
const constantPattern = parse('#a')

const getCoefficientsAndConstants = (node) => {
    const coefficients = {}
    const constants = []

    node.args.forEach(arg => {
        let results

        results = matchNode(pattern, arg, { x: isIdentifier, a: isNumber })

        if (results) {
            const {placeholders} = results

            const clone = { ...placeholders.x }

            delete clone.loc

            // The key is passed to JSON.parse later
            const key = JSON.stringify(clone)

            if (!(key in coefficients)) {
                coefficients[key] = []
            }

            coefficients[key].push(placeholders.a)
        }

        results = matchNode(constantPattern, arg, { a: isNumber })

        if (results) {
            constants.push(arg)
        }
    })

    return {coefficients, constants}
}

const rule = defineRule(
    (node) => {
        let hasLikeTerms = false
        if (isAdd(node)) {
            const {constants, coefficients} = getCoefficientsAndConstants(node)
            hasLikeTerms = constants.length > 1 ||
                Object.keys(coefficients)
                    .some(key => coefficients[key].length > 1)
        }
        if (hasLikeTerms) {
            return node
        }
    },

    (node) => {
        const {constants, coefficients} = getCoefficientsAndConstants(node)

        const result = applyNode(
            'add',
            Object.keys(coefficients).sort().map(key => {
                const coeffs = coefficients[key]
                const variable = JSON.parse(key)

                const terms = coeffs.map(coeff =>
                    populatePatternString('#a #x', {
                        a: coeff,
                        x: variable,  // it's okay to reuse b/c populatePattern clones
                    })
                )

                return terms.length > 1
                    ? applyNode('add', terms)
                    : terms[0]
            }))

        if (constants.length > 0) {
            result.args.push(applyNode('add', constants))
        }

        return result
    }
)

export default rule
