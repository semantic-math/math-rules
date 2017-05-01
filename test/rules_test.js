import assert from 'assert'
import {parse, print} from 'math-parser'

import * as nodes from '../lib/nodes'
import {applyRule} from '../lib/matcher.js'
import rules from '../lib/rules.js'

const applyRuleString = (rule, input) => print(applyRule(rule, parse(input)))

describe('applyRules', () => {
    it('negation', () => {
        const tests = [
            //['--1','1'],
            ['--x','x'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.NEGATION, t[0]), t[1]))
    })
    it.skip('division by negative one', () => {
        const tests = [
            ['2 / -1','-2'],
            ['x / -1','-x'],
            ['(x + 1) / -1', '-(x + 1)'],
            ['x ^ (2 / -1)', 'x ^ -2'],
        ]
        tests.forEach(t => test(applyRuleString(rules.DIVISION_BY_NEGATIVE_ONE ,t[0]), t[1]))
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
    it.skip('resolve double minus', () => {
        const tests = [
            ['2 - -1', '2 + 1'],
            ['x - -1', 'x + 1'],
            //['(x + 1) - -1', '(x + 1) + 1'],
            //['x^((x + 1) - -1)', 'x^((x + 1) + 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.RESOLVE_DOUBLE_MINUS, t[0]), t[1]))
    })
    it.skip('multiplying negatives', () => {
        const tests = [
            ['-2 * -1', '2 * 1'],
            ['-x * -1', 'x * 1'],
            ['-(x + 1) * -1', '(x + 1) * 1'],
            ['x^(-(x + 1) * -1)', 'x^((x + 1) * 1)'],
        ]
        tests.forEach(t => assert.equal(applyRuleString(rules.MULTIPLY_NEGATIVES, t[0]), t[1]))
    })

    /*
    it.skip('cancel minuses', () => {
        assert.equal(applyRuleString(rules.CANCEL_MINUSES, t[0]), t[1])
    })
    it.skip('simplify signs', () => {
        assert.equal(applyRuleString(rules.SIMPLIFY_SIGNS, t[0]), t[1])
    })

    //doesn't register parenthesis?

    it.skip('multiply fractions', () => {
        assert.equal(applyRuleString(rules.MULTIPLY_FRACTIONS, t[0]), t[1])
    })
    it.skip('simplfy division', () => {
        assert.equal(applyRuleString(rules.SIMPLIFY_DIVISION, t[0]), t[1])
    })
    it.skip('multiply by inverse', () => {
        assert.equal(applyRuleString(rules.MULTIPLY_BY_INVERSE, t[0], t[1])
    })


    it.skip('absolute value', () => {
        assert.equal(applyRuleString(rules.ABSOLUTE_VALUE, t[0]), t[1])
    })
    */
})
