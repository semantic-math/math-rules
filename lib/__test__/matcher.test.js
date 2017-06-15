import assert from 'assert'
import {parse, print} from 'math-parser'
import {build, query} from 'math-nodes'

import {matchNode, match} from '../matcher'
import {patternToMatchFn} from '../pattern'
import {isVariableFactor} from '../rules/collect-like-terms'


// returns the matched node in the AST of the parsed input
const matchString = (pattern, input) => {
    const matchFn = patternToMatchFn(parse(pattern))
    return match(matchFn, parse(input))
}

describe('matcher', () => {
    describe('matchNode', () => {
        it('should return true when the expressions are equal', () => {
            const ast1 = parse('1 + 2')
            const ast2 = parse(' 1  +  2')

            assert(matchNode(ast1, ast2))
        })

        it('should return true for sub-expressions in add and mul nodes', () => {
            assert(matchNode(parse('1 + 2'), parse('1 + 2 + 3')))
            assert(matchNode(parse('1 * 2'), parse('1 * 2 * 3')))
        })
    })

    describe('match', () => {
        it('should return false for sub-expressions not in add and mul nodes', () => {
            assert.equal(matchNode(parse('4 + 5'), parse('1 + 2 + 3')), null)
            assert.equal(matchNode(parse('4 * 5'), parse('1 * 2 * 3')), null)
        })

        it('should find a match for a sub-expression pattern in add and mul nodes', () => {
            assert(matchString('#a + #b', '1 + 2 + 3'))
            assert(matchString('#a * #b', '1 * 2 * 3'))
        })

        it('should find not find a match', () => {
            assert.equal(matchString('#a + #a', '1 + 2'), null)
        })

        it('should find match equal nodes', () => {
            assert(matchString('#a + #a', '1 + 1'))
        })

        it('should find match complex equal nodes', () => {
            assert(matchString('#a + #a', '1/a + 1/a'))
        })

        it('should find a match inside sub-expressions', () => {
            assert(matchString('#a + #b', '3 * (1 + 2)'))
        })

        it('should find match different complex expressions', () => {
            const result = matchString('#a + #b', '2 * a + 3 * b ^ 2')
            assert(result)
            const { node } = result
            assert(matchNode(node.args[0], parse('2 * a')))
            assert(matchNode(node.args[1], parse('3 * b ^ 2')))
        })

        it('should match patterns including constants', () => {
            assert(matchString('0 + #a', '0 + -5'))
            assert(matchString('#a + 0', '23 + 0'))
        })

        it('should match patterns including identifiers', () => {
            assert(matchString('#a x', '3 x'))
            assert(matchString('#a x + #b x', '3 x + 5 x'))
            assert.equal(matchString('#a x + #b x', '3 x + 5 y'), null)
        })
    })

    describe('partial variable length patterns', () => {
        it('match polynomials', () => {
            const {placeholders, indexes} = matchNode(
                parse('#a * #b_0 * ...'),
                parse('5 * x^2 * y * z * 10'),
                {
                    a: query.isNumber,      // isNumber is probably sufficient
                    b: isVariableFactor,    // match 'x', 'y^2', etc.
                }
            )

            assert.equal(print(placeholders.a), '5')
            assert.equal(print(placeholders.b[0]), 'x^2')
            assert.equal(print(placeholders.b[1]), 'y')
            assert.equal(print(placeholders.b[2]), 'z')
            // TODO: use a real array for placeholders
            assert.equal(placeholders.b[3], undefined)
        })

        it('match polynomials with additional factors at the start', () => {
            const {placeholders, indexes} = matchNode(
                parse('#a * #b_0 * ...'),
                parse('2 * 5 * x^2 * y * z'),
                {
                    a: query.isNumber,      // isNumber is probably sufficient
                    b: isVariableFactor,    // match 'x', 'y^2', etc.
                }
            )

            assert.equal(print(placeholders.a), '5')
            assert.equal(print(placeholders.b[0]), 'x^2')
            assert.equal(print(placeholders.b[1]), 'y')
            assert.equal(print(placeholders.b[2]), 'z')
            // TODO: use a real array for placeholders
            assert.equal(placeholders.b[3], undefined)
        })

        it('match polynomials with the coefficient at the end', () => {
            const {placeholders, indexes} = matchNode(
                parse('#b_0 * ... * #a'),
                parse('2 * x^2 * y * z * 5'),
                {
                    a: query.isNumber,      // isNumber is probably sufficient
                    b: isVariableFactor,    // match 'x', 'y^2', etc.
                }
            )

            assert.equal(print(placeholders.a), '5')
            assert.equal(print(placeholders.b[0]), 'x^2')
            assert.equal(print(placeholders.b[1]), 'y')
            assert.equal(print(placeholders.b[2]), 'z')
            // TODO: use a real array for placeholders
            assert.equal(placeholders.b[3], undefined)
        })

        it('match multiple variable length sections', () => {
            const {placeholders, indexes} = matchNode(
                parse('#b_0 * ... * #a * #c_0 * ...'),
                parse('2 * x^2 * y * z * 5 * a^2 * b * c'),
                {
                    a: query.isNumber,      // isNumber is probably sufficient
                    b: isVariableFactor,    // match 'x', 'y^2', etc.
                }
            )

            assert.equal(print(placeholders.a), '5')
            assert.equal(print(placeholders.b[0]), 'x^2')
            assert.equal(print(placeholders.b[1]), 'y')
            assert.equal(print(placeholders.b[2]), 'z')
            // TODO: use a real array for placeholders
            assert.equal(placeholders.b[3], undefined)
            assert.equal(print(placeholders.c[0]), 'a^2')
            assert.equal(print(placeholders.c[1]), 'b')
            assert.equal(print(placeholders.c[2]), 'c')
            assert.equal(placeholders.c[3], undefined)
        })
    })
})
