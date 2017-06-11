import assert from 'assert'
import {parse, print} from 'math-parser'
import {build, query} from 'math-nodes'

import {
    matchNode,
    match,
    defineRule,
    definePatternRule,
    canApplyRule,
    applyRule,
    populatePattern,
    patternToMatchFn,
} from '../matcher'

import {isVariableFactor} from '../rules/collect-like-terms'

// returns the rewritten string
const rewriteString = (matchPattern, rewritePattern, input) => {
    const rule = defineRuleString(matchPattern, rewritePattern)
    const ast = applyRule(rule, parse(input))
    return print(ast)
}

// returns the matched node in the AST of the parsed input
const matchString = (pattern, input) => {
    const matchFn = patternToMatchFn(parse(pattern))
    return match(matchFn, parse(input))
}

const defineRuleString = (matchPattern, rewritePattern, constraints) =>
    definePatternRule(parse(matchPattern), parse(rewritePattern), constraints)

const canApplyRuleString = (rule, input) => canApplyRule(rule, parse(input))

const applyRuleString = (rule, input) => print(applyRule(rule, parse(input)))

const populatePatternString = (pattern, placeholders) => populatePattern(parse(pattern), placeholders)

const isFunction = (val) => typeof val === 'function'


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

    describe('rewrite', () => {
        it('should replace x + 0', () => {
            const result = rewriteString('#a + 0', '#a', '2 * (x + 0)')
            assert.equal(result, '2 * x')
        })

        it('should replace x + 0 as a subexpression', () => {
            const result = rewriteString('#a + 0', '#a', '2 * (x + 0)')
            assert.equal(result, '2 * x')
        })

        it('should replace the innermost x + 0', () => {
            const result = rewriteString('#a + 0', '#a', '(x + 0) + 0')
            assert.equal(result, 'x + 0')
        })

        it('should replace x + 0 within a large expression', () => {
            const result = rewriteString('#a + 0', '#a', '1 + x + 0 + 2')
            assert.equal(result, '1 + x + 2')
        })

        it('should replace an single node with an add operation', () => {
            const result = rewriteString('2 #a', '#a + #a', '1 + 2 x + 2')
            assert.equal(result, '1 + (x + x) + 2')
        })

        it('should replace an single node with a mul operation', () => {
            const result = rewriteString('2 #a', '#a + #a', '1 * 2 x * 3')
            assert.equal(result, '1 * (x + x) * 3')
        })

        it('should work from the inside out', () => {
            const result = rewriteString('#a + 0', '#a', '((x + 0) + 0) + 0')
            assert.equal(result, '(x + 0) + 0')
        })

        it('should apply the rule a single time', () => {
            const result = rewriteString('#a + 0', '#a', '(x + 0) + (x + 0)')
            assert.equal(result, 'x + (x + 0)')

            const result2 = rewriteString('#a + 0', '#a', 'x + 0 + x + 0')
            assert.equal(result2, 'x + x + 0')
        })
    })

    describe('canApplyRule', () => {
        it('should accept applicable rules', () => {
            const rule = defineRuleString('#a + #a', '2 #a')
            assert(canApplyRuleString(rule, 'x + x'))
        })

        it('should reject unapplicable rules', () => {
            const rule = defineRuleString('#a + #a', '2 #a')
            assert.equal(canApplyRuleString(rule, 'x + y'), false)
        })

        it('should accept applicable rules based on constraints', () => {
            const rule = defineRuleString('#a + #a', '2 * #a', { a: query.isNumber })
            assert(canApplyRuleString(rule, '3 + 3'))
        })

        it('should reject unapplicable rules based on constraints', () => {
            const rule = defineRuleString('#a + #a', '2 #a', { a: query.isNumber })
            assert.equal(canApplyRuleString(rule, 'x + x'), false)
        })
    })

    describe('applyRule', () => {
        it('should apply applicable rules', () => {
            const rule = defineRuleString('#a + #a', '2 #a')
            assert.equal(applyRuleString(rule, 'x + x'), '2 x')
        })

        it('should apply applicable rules based on constraints', () => {
            const rule = defineRuleString('#a #x + #b #x', '(#a + #b) #x', {
                a: query.isNumber,
                b: query.isNumber,
            })
            assert.equal(applyRuleString(rule, '2 x + 3 x'), '(2 + 3) x')
            assert.equal(canApplyRuleString(rule, '(a + b) x'), false)
        })

        it('should apply rules with a rewrite callback', () => {
            const rule = defineRule(
                patternToMatchFn(parse('#a #b'), {b: query.isAdd}),
                (_, {a, b}) => build.applyNode(
                    'add',
                    b.args.map(arg => populatePatternString('#a #arg', {a, arg}))
                ),
                {b: query.isAdd})

            assert.equal(
                applyRuleString(rule, '3 (x + 1)'),
                '3 x + 3 1')

            assert.equal(
                applyRuleString(rule, '(a - b) (x^2 + 2x + 1)'),
                '(a - b) x^2 + (a - b) (2 x) + (a - b) 1')
        })

        it('should evaluate sums of numbers', () => {
            const rule = defineRule(
                patternToMatchFn(parse('#a'), {
                    a: (a) => query.isAdd(a) && a.args.every(query.isNumber)
                }),
                // TODO: use evaluate from node-parser
                // TODO: add a special 'eval' node so that we do '#eval(#a)'
                (_, {a}) => build.numberNode(
                    a.args.reduce((total, arg) => total + query.getValue(arg), 0)),
                {
                    a: (a) => query.isAdd(a) && a.args.every(query.isNumber)
                },
            )

            assert.equal(applyRuleString(rule, '(1 - 2 + 3) x'), '2 x')
            assert.equal(applyRuleString(rule, '(1 + 2 + 3) x'), '6 x')
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
