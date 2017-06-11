import assert from 'assert'
import {parse, print, evaluate} from 'math-parser'

import {applyRule, canApplyRule} from '../rule'
import * as rules from '../rule-list'

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
            assert.equal(t[1], print(applyRule(rule, parse(t[0]))))
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

    suite('rearrange coefficient', rules.REARRANGE_COEFF, [
        ['y^3 * 5', '5 y^3'],
        ['yz * 3', '3 yz'],
        // TODO: handle this case better
        //['3x^2 * 5', '5 (3 x^2)']
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

    suite('add numerators', rules.COMBINE_NUMERATORS, [
        ['1/3 + 2/3', '(1 + 2) / 3'],
        ['1/x + 2/x + 3/x', '(1 + 2 + 3) / x'],
        ['2/3 - 1/3', '(2 - 1) / 3'],
        ['(1/3 + 2/3) / x', '(1 + 2) / 3 / x'],
    ])

    suite('common denominators', rules.COMMON_DENOMINATOR, [
        ['2/6 + 1/4', '(2 * 2) / (6 * 2) + (1 * 3) / (4 * 3)'],
        ['2/6 - 1/4', '(2 * 2) / (6 * 2) - (1 * 3) / (4 * 3)'],
        ['2/6 + 1/4 - 2/5', '(2 * 10) / (6 * 10) + (1 * 15) / (4 * 15) - (2 * 12) / (5 * 12)'],
        ['2/6 + 1/4 - 3/4', '(2 * 2) / (6 * 2) + (1 * 3) / (4 * 3) - (3 * 3) / (4 * 3)'],
        // TODO: return the original expression if the denominators are already
        // the same?
        ['2/4 - 1/4', '(2 * 1) / (4 * 1) - (1 * 1) / (4 * 1)'],
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

    suite('simplify fraction', rules.SIMPLIFY_FRACTION, [
        ['-2/6', '-1 / 3'],
        ['3/-6', '-1 / 2'],
        ['-3/-6', '1 / 2'],
        ['1/3', '1 / 3'],
        ['2/6', '1 / 3'],
        ['15/24', '5 / 8'],
    ])

    suite('cancel exponent', rules.CANCEL_EXPONENT, [
        ['nthRoot(x^2, 4)', 'nthRoot(x^1, 2)'],
        ['nthRoot(a^15, 24)', 'nthRoot(a^5, 8)'],
        ['nthRoot(b^4, 2)', 'b^2'],
        ['nthRoot(d^10, 10)', 'd^1'],
        ['nthRoot(x^2)', 'x^1'],
        ['nthRoot(x^-2, 4)', 'nthRoot(x^-1, 2)'],
        ['nthRoot(x^7, -7)', 'x^-1'],
        ['nthRoot(y^-6, -3)', 'y^2'],
        ['nthRoot(z^-3, 3)', 'z^-1'],
    ])

    suite('combine under root', rules.COMBINE_UNDER_ROOT, [
        ['nthRoot(2, 2) * nthRoot(3, 2)', 'nthRoot(2 * 3, 2)'],
        ['nthRoot(4, 5) * nthRoot(5, 5) * nthRoot(6,5)', 'nthRoot(4 * 5 * 6, 5)'],
        ['nthRoot(x, 2) * nthRoot(y, 2)', 'nthRoot(x * y, 2)'],
        ['nthRoot(-2, 3) * nthRoot(-8, 3) * nthRoot(x^2, 3)', 'nthRoot(-2 * -8 * x^2, 3)'],
        ['nthRoot(2, x^2) * nthRoot(3, x^2)', 'nthRoot(2 * 3, x^2)']
    ])

    suite('distribute nthRoot', rules.DISTRIBUTE_NTH_ROOT, [
        ['nthRoot(2 * x, 2)', 'nthRoot(2, 2) * nthRoot(x, 2)'],
        ['nthRoot(3 * 3 * x, 3)', 'nthRoot(3, 3) * nthRoot(3, 3) * nthRoot(x, 3)'],
        ['nthRoot(x^2 * y^3 * z^4)', 'nthRoot(x^2, 2) * nthRoot(y^3, 2) * nthRoot(z^4, 2)']
    ])

    suite('convert multiplication to exponent', rules.CONVERT_MULTIPLICATION_TO_EXPONENT, [
        ['2^1 * 2^1 * 2^3', '2^5'],
        ['3^2 * 3^1 * 3^20', '3^23'],
    ])

    suite('evaluate distributed nthRoot', rules.EVALUATE_DISTRIBUTED_NTH_ROOT, [
        ['nthRoot(4, 2) * nthRoot(x^2, 2)', '2 * x^1'],
        ['nthRoot(4, 2) * nthRoot(x, 2)', '2 * nthRoot(x, 2)'],
        ['nthRoot(x^3, 3) * nthRoot(36, 2)', 'x^1 * 6'],
        ['nthRoot(x^-6, -4) * nthRoot(64, 3) * nthRoot(z^-50, 100)', 'nthRoot(x^3, 2) * 4 * nthRoot(z^-1, 2)']
        // TODO: handle this test case
        // ['x * nthRoot(4, 2) * nthRoot(x^2, 2) * y', 'x * 2 * x^1 * y'
    ])

    suite('factor into prime', rules.FACTOR_INTO_PRIME, [
        ['12' ,'2 * 2 * 3'],
        ['36', '2 * 2 * 3 * 3'],
        ['91', '7 * 13'],
        ['2', '2'],
        ['1', '1'],
    ])

    suite('group terms by root', rules.GROUP_TERMS_BY_ROOT, [
        ['nthRoot(2 * 2 * 2 * 3, 2)', 'nthRoot((2 * 2) * 2 * 3, 2)'],
        ['nthRoot(2 * 3 * 3 * 2, 3)', 'nthRoot((2 * 2) * (3 * 3), 3)'],
        ['nthRoot(5 * 7 * 9 * 7 * 7 * 7, 4)', 'nthRoot(5 * (7 * 7 * 7 * 7) * 9, 4)'],
        ['nthRoot(x^1 * x^1 * x^2 * y^3)', 'nthRoot((x^1 * x^1) * x^2 * y^3, 2)'],
        ['nthRoot(xyz * xyz * x y z * x y z, 4)', 'nthRoot((xyz * xyz) * (x y z * x y z), 4)']
    ])

    suite('nthRoot value', rules.NTH_ROOT_VALUE, [
        ['nthRoot(4, 2)', '2'],
        ['nthRoot(16, 2)', '4'],
        ['nthRoot(-8, 3)', '-2'],
        ['nthRoot(4, -2)', '.5'],
        ['nthRoot(16, -2)', '.25'],
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

    suite('fractional polynomials', rules.FRACTIONAL_POLYNOMIALS, [
        ['2x/3', '2 / 3 x'],
        ['3y^2/3', '3 / 3 y^2'],
        ['3x + 2x/3','3 x + 2 / 3 x']
    ])

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
        ['x^a * x^(b+c) * x^(d-e)', 'x^(a + (b + c) + (d - e))'],
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

    suite('negative exponent', rules.NEGATIVE_EXPONENT, [
        ['2^-2', '1 / 2^2'],
        ['2^-(5x)','1 / 2^(5 x)'],
        ['(3x)^-(2 - 4x)', '1 / (3 x)^(2 - 4 x)'],
    ])

    suite('to negative exponent', rules.TO_NEGATIVE_EXPONENT, [
        ['1 / 2^2', '1 * 2^-2'],
        ['x / 2^(-2)', 'x * 2^--2'],
        ['(3 - x) / (x + 5)^3', '(3 - x) * (x + 5)^-3']
    ])

    suite('fractional exponents', rules.FRACTIONAL_EXPONENTS, [
        ['a^(p/q)', 'a^(1 / q)^p'],
        ['(a + b)^(2/3)', '(a + b)^(1 / 3)^2'],
        ['a^((2 + x) / (2 - x))', 'a^(1 / (2 - x))^(2 + x)']
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
