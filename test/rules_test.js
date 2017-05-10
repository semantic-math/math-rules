import assert from 'assert'
import {parse, print, evaluate} from 'math-parser'

import * as nodes from '../lib/nodes'
import {applyRule, canApplyRule} from '../lib/matcher.js'
import * as rules from '../lib/rules.js'
import collectLikeTermsRule from '../lib/rules/collect-like-terms'

const applyRuleString = (rule, input) => print(applyRule(rule, parse(input)))

// TODO: fix test case under SIMPLIFY_DIVISION
// add more test cases (if possible)

describe('applyRules', () => {
    it('negation', () => {
        const tests = [
            ['--1','1'],
            ['--x','x'],
            ['--(x + 1)', 'x + 1'],
            ['x^(--(x + 1))', 'x^(x + 1)']
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.NEGATION, t[0]), t[1]))
    })
    it('division by negative one', () => {
        const tests = [
            ['2 / -1','-2'],
            ['x / -1','-x'],
            ['(x + 1) / -1', '-(x + 1)'],
            ['x ^ (2 / -1)', 'x^-2'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.DIVISION_BY_NEGATIVE_ONE ,t[0]), t[1]))
    })
    it('division by one', () => {
        const tests = [
            ['2 / 1', '2'],
            ['x / 1', 'x'],
            ['(x + 1) / 1', 'x + 1'],
            ['x^((x + 2) / 1)', 'x^(x + 2)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.DIVISION_BY_ONE, t[0]), t[1]))
    })
    it('multiply by zero', () => {
        const tests = [
            ['2 * 0', '0'],
            ['x * 0', '0'],
            ['(x + 1) * 0', '0'],
            ['x^((x + 1) * 0)', 'x^0'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.MULTIPLY_BY_ZERO, t[0]), t[1]))
    })
    it('multiply by zero reverse', () => {
        const tests = [
            ['0 * 2', '0'],
            ['0 * X', '0'],
            ['0 * (x + 1)', '0'],
            ['x^(0 * (x + 1))', 'x^0'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.MULTIPLY_BY_ZERO_REVERSE, t[0]), t[1]))
    })
    it('reduce exponent by zero', () => {
        const tests = [
            ['2 ^ 0', '1'],
            ['x ^ 0', '1'],
            ['(x + 1) ^ 0', '1'],
            ['x^((x + 1) ^ 0)', 'x^1'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REDUCE_EXPONENT_BY_ZERO, t[0]), t[1]))
    })
    it('reduce zero numerator', () => {
        const tests = [
            ['0 / 2', '0'],
            ['0 / x', '0'],
            ['0 / (x + 1)', '0'],
            ['x^(0 / (x + 1))', 'x^0'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REDUCE_ZERO_NUMERATOR, t[0]), t[1]))
    })
    it('remove adding zero', () => {
        const tests = [
            ['2 + 0', '2'],
            ['x + 0', 'x'],
            ['(x + 1) + 0', 'x + 1'],
            ['x^(x + 0)', 'x^x'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REMOVE_ADDING_ZERO, t[0]), t[1]))
    })
    it('remove adding zero reverse', () => {
        const tests = [
            ['0 + 2', '2'],
            ['0 + x', 'x'],
            ['0 + (x + 1)', 'x + 1'],
            ['x^(0 + x)', 'x^x'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REMOVE_ADDING_ZERO_REVERSE, t[0]), t[1]))
    })
    it('remove exponent by one', () => {
        const tests = [
            ['2 ^ 1', '2'],
            ['x ^ 1', 'x'],
            ['(x + 1) ^ 1', 'x + 1'],
            ['x^((x + 1)^1)', 'x^(x + 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REMOVE_EXPONENT_BY_ONE, t[0]), t[1]))
    })
    it('remove exponent by base one', () => {
        const tests = [
            ['1 ^ 2', '1'],
            ['1 ^ x', '1'],
            ['1 ^ (x + 1)', '1'],
            ['x^(1 ^ (x + 1))', 'x^1'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REMOVE_EXPONENT_BASE_ONE, t[0]), t[1]))
    })
    it('remove multiplying by negative one', () => {
        const tests = [
            ['2 * -1', '-2'],
            ['x * -1', '-x'],
            ['(x + 1) * -1', '-(x + 1)'],
            ['x^((x + 1) * -1)', 'x^-(x + 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_NEGATIVE_ONE, t[0]), t[1]))
    })
    it('remove multiplying by one', () => {
        const tests = [
            ['2 * 1', '2'],
            ['x * 1', 'x'],
            ['(x + 1) * 1', 'x + 1'],
            ['x^((x + 1) * 1)', 'x^(x + 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_ONE, t[0]), t[1]))
    })
    it('remove multiplying by one reverse', () => {
        const tests = [
            ['1 * 2', '2'],
            ['1 * x', 'x'],
            ['1 * (x + 1)', 'x + 1'],
            ['x^(1 * (x + 1))', 'x^(x + 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_ONE_REVERSE, t[0]), t[1]))
    })
    it('resolve double minus', () => {
        const tests = [
            ['2 - -1', '2 + 1'],
            ['x - -1', 'x + 1'],
            ['(x + 1) - -1', '(x + 1) + 1'],
            ['x^((x + 1) - -1)', 'x^((x + 1) + 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.RESOLVE_DOUBLE_MINUS, t[0]), t[1]))
    })
    it('multiplying negatives', () => {
        const tests = [
            ['-2 * -1', '2 * 1'],
            ['-x * -1', 'x * 1'],
            ['-(x + 1) * -1', '(x + 1) * 1'],
            ['x^(-(x + 1) * -1)', 'x^((x + 1) * 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.MULTIPLY_NEGATIVES, t[0]), t[1]))
    })
    it('remove multiplying by negative one', () => {
        const tests = [
            ['2 * -1', '-2'],
            ['x * -1', '-x'],
            ['(x + 1) * -1', '-(x + 1)'],
            ['x^((x + 1) * -1)', 'x^-(x + 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_NEGATIVE_ONE, t[0]), t[1]))
    })
    it('cancel minuses', () => {
        const tests = [
            ['-2 / -1', '2 / 1'],
            ['-x / -1', 'x / 1'],
            ['-(x + 1) / -1', '(x + 1) / 1'],
            ['x^(-(x + 1) / -1)', 'x^((x + 1) / 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.CANCEL_MINUSES, t[0]), t[1]))
    })
    it('simplify signs', () => {
        const tests = [
            ['2 / -1', '-2 / 1'],
            ['x / -1', '-x / 1'],
            ['(x + 1) / -1', '-(x + 1) / 1'],
            ['x^((x + 1) / -1)', 'x^(-(x + 1) / 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.SIMPLIFY_SIGNS, t[0]), t[1]))
    })
    it('multiply fractions', () => {
        const tests = [
            ['2 / 3 * 2 / 3', '(2 * 2) / (3 * 3)'],
            ['x / 2 * x / 2', '(x * x) / (2 * 2)'],
            ['(x + 1) / 2 * (x + 1) / 2', '((x + 1) * (x + 1)) / (2 * 2)'],
            ['x^((x + 1) / 2 * (x + 1) / 2)', 'x^(((x + 1) * (x + 1)) / (2 * 2))'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.MULTIPLY_FRACTIONS, t[0]), t[1]))
    })
    it('simplify division', () => {
        const tests = [
            ['2 / 3 / 4', '2 / (3 * 4)'],
            ['x / 2 / 2', 'x / (2 * 2)'],
            ['(x + 1) / 2 / (x + 1)', '(x + 1) / (2 * (x + 1))'],
            //['x^((x + 1) / 2 / 2)', 'x^(x + 1) / (2 * 2)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.SIMPLIFY_DIVISION, t[0]), t[1]))
    })
    it('multiply by inverse', () => {
        const tests = [
            ['2 / (3 / 4)', '2 * 4 / 3'],
            ['x / (2 / 2)', 'x * 2 / 2'],
            ['(x + 1) / (2 / (x + 1))', '(x + 1) * (x + 1) / 2'],
            ['x^((x + 1) / (2 / 2))', 'x^((x + 1) * 2 / 2)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.MULTIPLY_BY_INVERSE, t[0]), t[1]))
    })
    it('absolute value', () => {
        const tests = [
            ['|-2|', '2'],
            ['|-x|', 'x'],
            ['|-(x + 1)|', 'x + 1'],
            ['x^(|-(x + 1)|)', 'x^(x + 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.ABSOLUTE_VALUE, t[0]), t[1]))
    })
    it('collects like terms', () => {
        const tests = [
            ['2x + 1 - 2x', '(2 x - 2 x) + 1'],
            ['2x + 1 - x', '(2 x - x) + 1'],
            ['x^2 + 1 + x^2', '(x^2 + x^2) + 1'],
            ['x^y + 1 + x^y', '(x^y + x^y) + 1'],
            ['x y + 1 + x y', '(x y + x y) + 1'],
            ['3 x y + 1 - 2 x y', '(3 x y - 2 x y) + 1'],
            // ['x y + 1 + y x', '(x y + x y) + 1'],  // TODO: this case should pass
            ['x^2 + 2x^2 - 3x^3 - 4x^3', '(x^2 + 2 x^2) + (-3 x^3 - 4 x^3)'],
            ['2x + 7y + 5 + 3y + 9x + 11', '(2 x + 9 x) + (7 y + 3 y) + (5 + 11)'],
        ]

        assert.equal(canApplyRule(collectLikeTermsRule, parse('x + 1')), false)

        tests.forEach(t => {
            const ast = parse(t[0])
            const result = print(applyRule(collectLikeTermsRule, parse(t[0])))
            assert.equal(result, t[1])
        })
    })
    describe('handles basic arithmetic', () => {
        const tests = [
            ['1 + 2', '3'],
            ['1 + 2 + 3', '6'],
            ['3 * 8', '24'],
            ['-2^2', '-4'],
            ['(-2)^2', '4'], // TODO: remove parentheses node so this passes
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.SIMPLIFY_ARITHMETIC, t[0]), t[1])
            })
        })
    })
    describe('collect constant exponents', () => {
        const tests = [
            ['10^2 * ... * 10^3', '10^(2 + ... + 3)'],
            ['x^a * ... * x^b', 'x^(a + ... + b)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                const input = parse(t[0])
                const output = parse(t[1])

                assert.equal(applyRuleString(rules.COLLECT_CONSTANT_EXPONENTS, t[0]), t[1])
            })
        })
    })
})
