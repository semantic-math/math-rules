import assert from 'assert'
import {parse, print, evaluate} from 'math-parser'

import {applyRule, canApplyRule} from '../lib/matcher.js'
import * as rules from '../lib/rules.js'

const applyRuleString = (rule, input) => print(applyRule(rule, parse(input)))
const canApplyRuleString = (rule, input) => canApplyRule(rule, parse(input))

const suite = (title, rule, tests) => describe(title, () => {
    tests.forEach(t => {
        it(`${t[0]} => ${t[1]}`, () => {
            assert.equal(print(applyRule(rule, parse(t[0]))), t[1])
        })
    })
})

suite.only = (title, rule, tests) => describe.only(title, () => {
    tests.forEach(t => {
        it(`${t[0]} => ${t[1]}`, () => {
            assert.equal(print(applyRule(rule, parse(t[0]))), t[1])
        })
    })
})


describe('rules', () => {
    suite('negation', rules.NEGATION, [
        ['--1','1'],
        ['--x','x'],
        ['--(x + 1)', 'x + 1'],
        ['x^(--(x + 1))', 'x^(x + 1)']
    ])

    suite('division by negative one', rules.DIVISION_BY_NEGATIVE_ONE, [
        ['2 / -1','-2'],
        ['x / -1','-x'],
        ['(x + 1) / -1', '-(x + 1)'],
        ['x ^ (2 / -1)', 'x^-2'],
    ])

    suite('division by one', rules.DIVISION_BY_ONE, [
        ['2 / 1', '2'],
        ['x / 1', 'x'],
        ['(x + 1) / 1', 'x + 1'],
        ['x^((x + 2) / 1)', 'x^(x + 2)'],
    ])

    suite('multiply by zero', rules.MULTIPLY_BY_ZERO, [
        ['2 * 0', '0'],
        ['x * 0', '0'],
        ['x 0', '0'],
        ['(x + 1) * 0', '0'],
        ['x^((x + 1) * 0)', 'x^0'],
    ])

    suite('multiply by zero reverse', rules.MULTIPLY_BY_ZERO_REVERSE, [
        ['0 * 2', '0'],
        ['0 * x', '0'],
        ['0 x', '0'],
        ['0 * (x + 1)', '0'],
        ['x^(0 * (x + 1))', 'x^0'],
    ])

    suite('reduce exponent by zero', rules.REDUCE_EXPONENT_BY_ZERO, [
        ['2 ^ 0', '1'],
        ['x ^ 0', '1'],
        ['(x + 1) ^ 0', '1'],
        ['x^((x + 1) ^ 0)', 'x^1'],
    ])

    suite('reduce zero numerator', rules.REDUCE_ZERO_NUMERATOR, [
        ['0 / 2', '0'],
        ['0 / x', '0'],
        ['0 / (x + 1)', '0'],
        ['x^(0 / (x + 1))', 'x^0'],
    ])

    suite('remove adding zero', rules.REMOVE_ADDING_ZERO, [
        ['2 + 0', '2'],
        ['2 + 0 + x', '2 + x'],
        ['x + 0', 'x'],
        ['(x + 1) + 0', 'x + 1'],
        ['x^(x + 0)', 'x^x'],
    ])

    suite('remove adding zero reverse', rules.REMOVE_ADDING_ZERO_REVERSE, [
        ['0 + 2', '2'],
        ['0 + x', 'x'],
        ['0 + (x + 1)', 'x + 1'],
        ['x^(0 + x)', 'x^x'],
    ])

    suite('remove exponent by one', rules.REMOVE_EXPONENT_BY_ONE, [
        ['2 ^ 1', '2'],
        ['x ^ 1', 'x'],
        ['(x + 1) ^ 1', 'x + 1'],
        ['x^((x + 1)^1)', 'x^(x + 1)'],
    ])

    suite('remove exponent by base one', rules.REMOVE_EXPONENT_BASE_ONE, [
        ['1 ^ 2', '1'],
        ['1 ^ x', '1'],
        ['1 ^ (x + 1)', '1'],
        ['x^(1 ^ (x + 1))', 'x^1'],
    ])

    suite('remove multiplying by negative one', rules.REMOVE_MULTIPLYING_BY_NEGATIVE_ONE, [
        ['2 * -1', '-2'],
        ['x * -1', '-x'],
        ['(x + 1) * -1', '-(x + 1)'],
        ['x^((x + 1) * -1)', 'x^-(x + 1)'],
        ['2x * 2 * -1', '2 x * -2'],
    ])

    suite('remove multiplying by one', rules.REMOVE_MULTIPLYING_BY_ONE, [
        ['2 * 1', '2'],
        ['x * 1', 'x'],
        ['x 1', 'x'],
        ['(x + 1) * 1', 'x + 1'],
        ['x^((x + 1) * 1)', 'x^(x + 1)'],
        ['2 * 1 * z^2', '2 * z^2'],
    ])

    suite('remove multiplying by one reverse', rules.REMOVE_MULTIPLYING_BY_ONE_REVERSE, [
        ['1 * 2', '2'],
        ['1 * x', 'x'],
        ['1 x', 'x'],
        ['1 * (x + 1)', 'x + 1'],
        ['x^(1 * (x + 1))', 'x^(x + 1)'],
    ])

    suite('resolve double minus', rules.RESOLVE_DOUBLE_MINUS, [
        ['2 - -1', '2 + 1'],
        ['x - -1', 'x + 1'],
        ['(x + 1) - -1', '(x + 1) + 1'],
        ['x^((x + 1) - -1)', 'x^((x + 1) + 1)'],
    ])

    suite('multiplying negatives', rules.MULTIPLY_NEGATIVES, [
        ['-2 * -1', '2 * 1'],
        ['-x * -1', 'x * 1'],
        ['-(x + 1) * -1', '(x + 1) * 1'],
        ['x^(-(x + 1) * -1)', 'x^((x + 1) * 1)'],
    ])

    suite('remove multiplying by negative one', rules.REMOVE_MULTIPLYING_BY_NEGATIVE_ONE, [
        ['2 * -1', '-2'],
        ['x * -1', '-x'],
        ['(x + 1) * -1', '-(x + 1)'],
        ['x^((x + 1) * -1)', 'x^-(x + 1)'],
    ])

    suite('cancel minuses', rules.CANCEL_MINUSES, [
        ['-2 / -1', '2 / 1'],
        ['-x / -1', 'x / 1'],
        ['-(x + 1) / -1', '(x + 1) / 1'],
        ['x^(-(x + 1) / -1)', 'x^((x + 1) / 1)'],
    ])

    suite('simplify signs', rules.SIMPLIFY_SIGNS, [
        ['2 / -1', '-2 / 1'],
        ['x / -1', '-x / 1'],
        ['(x + 1) / -1', '-(x + 1) / 1'],
        ['x^((x + 1) / -1)', 'x^(-(x + 1) / 1)'],
    ])

    suite('multiply fractions', rules.MULTIPLY_FRACTIONS, [
        ['2 / 3 * 2 / 3', '(2 * 2) / (3 * 3)'],
        ['x / 2 * x / 2', '(x * x) / (2 * 2)'],
        ['(x + 1) / 2 * (x + 1) / 2', '((x + 1) * (x + 1)) / (2 * 2)'],
        ['x^((x + 1) / 2 * (x + 1) / 2)', 'x^(((x + 1) * (x + 1)) / (2 * 2))'],
    ])

    suite('simplify division', rules.SIMPLIFY_DIVISION, [
        ['2 / 3 / 4', '2 / (3 * 4)'],
        ['x / 2 / 2', 'x / (2 * 2)'],
        ['(x + 1) / 2 / (x + 1)', '(x + 1) / (2 * (x + 1))'],
        ['x^((x + 1) / 2 / 2)', 'x^((x + 1) / (2 * 2))'],
    ])

    suite('multiply by inverse', rules.MULTIPLY_BY_INVERSE, [
        ['2 / (3 / 4)', '2 * 4 / 3'],
        ['x / (2 / 2)', 'x * 2 / 2'],
        ['(x + 1) / (2 / (x + 1))', '(x + 1) * (x + 1) / 2'],
        ['x^((x + 1) / (2 / 2))', 'x^((x + 1) * 2 / 2)'],
    ])

    suite('absolute value', rules.ABSOLUTE_VALUE, [
        ['|-2|', '2'],
        ['|-x|', 'x'],
        ['|-(x + 1)|', 'x + 1'],
        ['x^(|-(x + 1)|)', 'x^(x + 1)'],
    ])

    suite('collects like terms', rules.COLLECT_LIKE_TERMS, [
        ['2x + 1 - 2x', '(2 x - 2 x) + 1'],
        ['2x + 1 - x', '(2 x - x) + 1'],
        ['x^2 + 1 + x^2', '(x^2 + x^2) + 1'],
        ['x^y + 1 + x^y', '(x^y + x^y) + 1'],
        ['x y + 1 + x y', '(x y + x y) + 1'],
        ['3 x y + 1 - 2 x y', '(3 x y - 2 x y) + 1'],
        ['x y + 1 + y x', '(x y + x y) + 1'],
        ['x y + 1 + 3 y x', '(x y + 3 x y) + 1'],
        ['x^2 + 2x^2 - 3x^3 - 4x^3', '(x^2 + 2 x^2) + (-3 x^3 - 4 x^3)'],
        ['2x + 7y + 5 + 3y + 9x + 11', '(2 x + 9 x) + (7 y + 3 y) + (5 + 11)'],
    ])

    // ADDING POLYNOMIALS

    suite('add polynomials', rules.ADD_POLYNOMIAL_TERMS, [
        ['2x + 2x + 2 + 4', '4 x + (2 + 4)'],
        ['3y^2 - 2y^2 + y^4', '1 y^2 + 1 y^4'],
        ['x - x', '0 x'],
        ['2x + 3x + 2y + 3y', '5 x + 5 y'],
        ['-2y + 3y', '1 y'],
        ['3 xy + 2 xy', '5 xy'],
        ['3 xy - 2 xy + x^2y^2', '1 x^2 y^2 + 1 xy'],
        ['2 x y + 2 y x', '4 x y'],
    ])

    suite('handles basic arithmetic', rules.SIMPLIFY_ARITHMETIC, [
        ['1 + 2', '3'],
        ['1 + 2 + 3', '6'],
        ['3 * 8', '24'],
        ['-2^2', '-4'],
        ['(-2)^2', '4'],
        ['1 + 2 + y', '3 + y'],
        ['x + 1 + 2', 'x + 3'],
        ['x + 1 + 2 + y', 'x + 3 + y'],
        ['2 * 4 * y', '8 * y'],
        ['x * 2 * 4', 'x * 8'],
        ['x * 2 * 4 * y', 'x * 8 * y'],
        // TODO: enable after adding option to apply rule multiple times
        // ['x + 1 + 2 + y + 3 + 4 + z', 'x + 3 + y + 7 + z'],
    ])

    suite('evaluate addition', rules.EVALUATE_ADDITION, [
        ['1 + 2', '3'],
        ['1 + 2 + 3 + 4', '10'],
        ['x + 1 + 2 + y', 'x + 3 + y'],
    ])

    suite('evaluate multiplication', rules.EVALUATE_MULTIPLICATION, [
        ['2 * 4', '8'],
        ['2 * 4 * 6', '48'],
        ['x * 2 * 4 * y', 'x * 8 * y'],
    ])

    suite('evaluate division', rules.EVALUATE_DIVISION, [
        ['10 / 5', '2'],
        ['x^(10 / 5)', 'x^2'],
        ['10 / 5 / x', '2 / x'],
        ['x / (10 / 5)', 'x / 2'],
    ])

    suite('evaluate power', rules.EVALUATE_POWER, [
        ['(-2)^2', '4'],
        ['-2^2', '-4'],
        ['(-2)^3', '-8'],
        ['2^3', '8'],
        ['x^2^3', 'x^8'],
        ['(2^3)^x', '8^x'],
    ])

    suite('product rule', rules.PRODUCT_RULE, [
        ['10^2 * 10^5 * 10^3', '10^(2 + 5 + 3)'],
        ['x^a * x^b * x^c', 'x^(a + b + c)'],
        ['x^a * x^(b+c) * x^(d*e)', 'x^(a + (b + c) + d * e)'],
        ['5 * 10^2 * 10^5 * 10^3', '5 * 10^(2 + 5 + 3)'],
        ['10^2 * 10^5 * 10^3 * 5', '10^(2 + 5 + 3) * 5'],
        ['5 * 10^2 * 10^5 * 10^3 * 5', '5 * 10^(2 + 5 + 3) * 5'],
        // TODO: handle this case
        // ['10^2 * 10^3 * x^a * x^b', '10^(2 + 3) * x^(a + b)'],
    ])

    suite('quotient rule', rules.QUOTIENT_RULE, [
        ['x^5 / x^3', 'x^(5 - 3)'],
        ['x^-a / x^-b', 'x^(-a - -b)'],
    ])

    suite('power of a product', rules.POWER_OF_A_PRODUCT, [
        ['(2*3)^x', '2^x * 3^x'],
        ['(2*3*5)^x', '2^x * 3^x * 5^x'],
        ['(a*b*c*d)^x', 'a^x * b^x * c^x * d^x'],
        ['(p*q)^(x+y)', 'p^(x + y) * q^(x + y)'],
        ['(p*q)^(x-y)', 'p^(x - y) * q^(x - y)'],
    ])

    suite('power of a quotient', rules.POWER_OF_A_QUOTIENT, [
        ['(5 / 3)^x', '5^x / 3^x'],
    ])

    suite('break up fraction', rules.BREAK_UP_FRACTION, [
        ['(a + b) / 2', 'a / 2 + b / 2'],
        ['(a + b + c) / 2', 'a / 2 + b / 2 + c / 2'],
        ['(a + b) / (2n)', 'a / (2 n) + b / (2 n)'],
        ['(a + b) / (x+y)', 'a / (x + y) + b / (x + y)'],
        ['(a - b) / 2', 'a / 2 - b / 2'],
    ])

    suite('distribute', rules.DISTRIBUTE, [
        ['2 * (x + 1)', '2 * x + 2 * 1'],
        ['2 * (x - 1)', '2 * x - 2 * 1'],
        ['(a + b) * (x + y)', '(a + b) * x + (a + b) * y'],
        ['(a - b) * (x - y)', '(a - b) * x - (a - b) * y'],
        ['2 * (x + 1) - 3 * (y - 1)', '(2 * x + 2 * 1) - 3 * (y - 1)'],
        ['1 - 3 * (y - 1)', '1 - (3 * y - 3 * 1)'],
    ])

    suite('distribute right', rules.DISTRIBUTE_RIGHT, [
        ['(x + 1) * 2', 'x * 2 + 1 * 2'],
        ['(x - 1) * 2', 'x * 2 - 1 * 2'],
        ['(a + b) * (x + y)', 'a * (x + y) + b * (x + y)'],
        ['(a - b) * (x - y)', 'a * (x - y) - b * (x - y)'],
    ])

    suite('distribute negative one', rules.DISTRIBUTE_NEGATIVE_ONE, [
        ['-(x + 1)', '-1 * x + -1 * 1'],
        ['-(x - 1)', '-1 * x - -1 * 1'],
        ['-(a + b + c)', '-1 * a + -1 * b + -1 * c'],
    ])


    // SOLVING FOR A VARIABLE
    suite('add to both sides', rules.ADD_TO_BOTH_SIDES, [
        ['x - 3 = 2', 'x - 3 + 3 = 2 + 3'],
    ])

    suite('subtract from both sides', rules.SUBTRACT_FROM_BOTH_SIDES, [
        ['x + 3 = 2', 'x + 3 - 3 = 2 - 3'],
    ])

    suite('multiple both sides', rules.MULTIPLY_BOTH_SIDES, [
        ['x / 2 = 1', 'x / 2 * 2 = 1 * 2'],
    ])

    suite('divide from both sides', rules.DIVIDE_FROM_BOTH_SIDES, [
        ['2 x = 1', '(2 x) / 2 = 1 / 2'],
    ])

    suite('multiple both sides by inverse fraction', rules.MULTIPLY_BOTH_SIDES_BY_INVERSE_FRACTION, [
        ['2 / 3 * x = 1', '2 / 3 * x * 3 / 2 = 1 * 3 / 2'],
    ])

    suite('multiple both sides by negative one', rules.MULTIPLY_BOTH_SIDES_BY_NEGATIVE_ONE, [
        ['-x = 2', '-1 * -x = -1 * 2'],
    ])

    suite('swap sides', rules.SWAP_SIDES, [
        ['2 = x', 'x = 2'],
    ])
})

describe('canApplyRule', () => {
    describe('COLLECT_LIKE_TERMS', () => {
        it('2x + 1 - 2x should pass', () => {
            assert(canApplyRuleString(rules.COLLECT_LIKE_TERMS, '2x + 1 - 2x'))
        })

        it('2 x y + 1 - y x should pass', () => {
            assert(canApplyRuleString(rules.COLLECT_LIKE_TERMS, '2 x y + 1 - y x'))
        })

        it('2x + 1 - 3y should fail', () => {
            assert.equal(canApplyRuleString(rules.COLLECT_LIKE_TERMS, '2x + 1 - 3y'), false)
        })
    })

    describe('SIMPLIFY_ARITHMETIC', () => {
        it('a + b + c should fail', () => {
            assert.equal(canApplyRuleString(rules.SIMPLIFY_ARITHMETIC, 'a + b + c'), false)
        })
    })
})
