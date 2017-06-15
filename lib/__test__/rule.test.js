import assert from 'assert'
import {parse, print} from 'math-parser'
import {build, query} from 'math-nodes'

import {defineRule, definePatternRule, canApplyRule, applyRule} from '../rule'
import {populatePattern, patternToMatchFn} from '../pattern'


// returns the rewritten string
const rewriteString = (matchPattern, rewritePattern, input) => {
    const rule = defineRuleString(matchPattern, rewritePattern)
    const ast = applyRule(rule, parse(input))
    return print(ast)
}

const defineRuleString = (matchPattern, rewritePattern, constraints) =>
    definePatternRule(parse(matchPattern), parse(rewritePattern), constraints)

const canApplyRuleString = (rule, input) => canApplyRule(rule, parse(input))

const applyRuleString = (rule, input) => print(applyRule(rule, parse(input)))

const populatePatternString = (pattern, placeholders) => populatePattern(parse(pattern), placeholders)

const isFunction = (val) => typeof val === 'function'

describe('rule functions', () => {
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
})
