import assert from 'assert'
import {parse, print, evaluate} from 'math-parser'

import {applyRule, canApplyRule} from '../lib/matcher.js'
import * as rules from '../lib/rules.js'
import collectLikeTermsRule from '../lib/rules/collect-like-terms'

const applyRuleString = (rule, input) => print(applyRule(rule, parse(input)))

const suite = (title, rule, tests) => describe(title, () => {
    tests.forEach(t => {
        it(`${t[0]} => ${t[1]}`, () => {
            assert.equal(applyRuleString(rule, t[0]), t[1])
        })
    })
})

// TODO: fix test case under SIMPLIFY_DIVISION
// add more test cases (if possible)

describe('rules', () => {
    describe('negation', () => {
        const tests = [
            ['--1','1'],
            ['--x','x'],
            ['--(x + 1)', 'x + 1'],
            ['x^(--(x + 1))', 'x^(x + 1)']
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.NEGATION, t[0]), t[1])
            })
        })
    })

    describe('division by negative one', () => {
        const tests = [
            ['2 / -1','-2'],
            ['x / -1','-x'],
            ['(x + 1) / -1', '-(x + 1)'],
            ['x ^ (2 / -1)', 'x^-2'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.DIVISION_BY_NEGATIVE_ONE, t[0]), t[1])
            })
        })
    })

    describe('division by one', () => {
        const tests = [
            ['2 / 1', '2'],
            ['x / 1', 'x'],
            ['(x + 1) / 1', 'x + 1'],
            ['x^((x + 2) / 1)', 'x^(x + 2)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.DIVISION_BY_ONE, t[0]), t[1])
            })
        })
    })

    describe('multiply by zero', () => {
        const tests = [
            ['2 * 0', '0'],
            ['x * 0', '0'],
            ['(x + 1) * 0', '0'],
            ['x^((x + 1) * 0)', 'x^0'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.MULTIPLY_BY_ZERO, t[0]), t[1])
            })
        })
    })

    describe('multiply by zero reverse', () => {
        const tests = [
            ['0 * 2', '0'],
            ['0 * X', '0'],
            ['0 * (x + 1)', '0'],
            ['x^(0 * (x + 1))', 'x^0'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.MULTIPLY_BY_ZERO_REVERSE, t[0]), t[1])
            })
        })
    })

    describe('reduce exponent by zero', () => {
        const tests = [
            ['2 ^ 0', '1'],
            ['x ^ 0', '1'],
            ['(x + 1) ^ 0', '1'],
            ['x^((x + 1) ^ 0)', 'x^1'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REDUCE_EXPONENT_BY_ZERO, t[0]), t[1])
            })
        })
    })

    describe('reduce zero numerator', () => {
        const tests = [
            ['0 / 2', '0'],
            ['0 / x', '0'],
            ['0 / (x + 1)', '0'],
            ['x^(0 / (x + 1))', 'x^0'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REDUCE_ZERO_NUMERATOR, t[0]), t[1])
            })
        })
    })

    describe('remove adding zero', () => {
        const tests = [
            ['2 + 0', '2'],
            ['x + 0', 'x'],
            ['(x + 1) + 0', 'x + 1'],
            ['x^(x + 0)', 'x^x'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REMOVE_ADDING_ZERO, t[0]), t[1])
            })
        })
    })

    describe('remove adding zero reverse', () => {
        const tests = [
            ['0 + 2', '2'],
            ['0 + x', 'x'],
            ['0 + (x + 1)', 'x + 1'],
            ['x^(0 + x)', 'x^x'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REMOVE_ADDING_ZERO_REVERSE, t[0]), t[1])
            })
        })
    })

    describe('remove exponent by one', () => {
        const tests = [
            ['2 ^ 1', '2'],
            ['x ^ 1', 'x'],
            ['(x + 1) ^ 1', 'x + 1'],
            ['x^((x + 1)^1)', 'x^(x + 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REMOVE_EXPONENT_BY_ONE, t[0]), t[1])
            })
        })
    })

    describe('remove exponent by base one', () => {
        const tests = [
            ['1 ^ 2', '1'],
            ['1 ^ x', '1'],
            ['1 ^ (x + 1)', '1'],
            ['x^(1 ^ (x + 1))', 'x^1'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REMOVE_EXPONENT_BASE_ONE, t[0]), t[1])
            })
        })
    })

    describe('remove multiplying by negative one', () => {
        const tests = [
            ['2 * -1', '-2'],
            ['x * -1', '-x'],
            ['(x + 1) * -1', '-(x + 1)'],
            ['x^((x + 1) * -1)', 'x^-(x + 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_NEGATIVE_ONE, t[0]), t[1])
            })
        })
    })

    describe('remove multiplying by one', () => {
        const tests = [
            ['2 * 1', '2'],
            ['x * 1', 'x'],
            ['(x + 1) * 1', 'x + 1'],
            ['x^((x + 1) * 1)', 'x^(x + 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_ONE, t[0]), t[1])
            })
        })
    })

    describe('remove multiplying by one reverse', () => {
        const tests = [
            ['1 * 2', '2'],
            ['1 * x', 'x'],
            ['1 * (x + 1)', 'x + 1'],
            ['x^(1 * (x + 1))', 'x^(x + 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_ONE_REVERSE, t[0]), t[1])
            })
        })
    })

    describe('resolve double minus', () => {
        const tests = [
            ['2 - -1', '2 + 1'],
            ['x - -1', 'x + 1'],
            ['(x + 1) - -1', '(x + 1) + 1'],
            ['x^((x + 1) - -1)', 'x^((x + 1) + 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.RESOLVE_DOUBLE_MINUS, t[0]), t[1])
            })
        })
    })

    describe('multiplying negatives', () => {
        const tests = [
            ['-2 * -1', '2 * 1'],
            ['-x * -1', 'x * 1'],
            ['-(x + 1) * -1', '(x + 1) * 1'],
            ['x^(-(x + 1) * -1)', 'x^((x + 1) * 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.MULTIPLY_NEGATIVES, t[0]), t[1])
            })
        })
    })

    describe('remove multiplying by negative one', () => {
        const tests = [
            ['2 * -1', '-2'],
            ['x * -1', '-x'],
            ['(x + 1) * -1', '-(x + 1)'],
            ['x^((x + 1) * -1)', 'x^-(x + 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.REMOVE_MULTIPLYING_BY_NEGATIVE_ONE, t[0]), t[1])
            })
        })
    })

    describe('cancel minuses', () => {
        const tests = [
            ['-2 / -1', '2 / 1'],
            ['-x / -1', 'x / 1'],
            ['-(x + 1) / -1', '(x + 1) / 1'],
            ['x^(-(x + 1) / -1)', 'x^((x + 1) / 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.CANCEL_MINUSES, t[0]), t[1])
            })
        })
    })

    describe('simplify signs', () => {
        const tests = [
            ['2 / -1', '-2 / 1'],
            ['x / -1', '-x / 1'],
            ['(x + 1) / -1', '-(x + 1) / 1'],
            ['x^((x + 1) / -1)', 'x^(-(x + 1) / 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.SIMPLIFY_SIGNS, t[0]), t[1])
            })
        })
    })

    describe('multiply fractions', () => {
        const tests = [
            ['2 / 3 * 2 / 3', '(2 * 2) / (3 * 3)'],
            ['x / 2 * x / 2', '(x * x) / (2 * 2)'],
            ['(x + 1) / 2 * (x + 1) / 2', '((x + 1) * (x + 1)) / (2 * 2)'],
            ['x^((x + 1) / 2 * (x + 1) / 2)', 'x^(((x + 1) * (x + 1)) / (2 * 2))'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.MULTIPLY_FRACTIONS, t[0]), t[1])
            })
        })
    })

    describe('simplify division', () => {
        const tests = [
            ['2 / 3 / 4', '2 / (3 * 4)'],
            ['x / 2 / 2', 'x / (2 * 2)'],
            ['(x + 1) / 2 / (x + 1)', '(x + 1) / (2 * (x + 1))'],
            ['x^((x + 1) / 2 / 2)', 'x^((x + 1) / (2 * 2))'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.SIMPLIFY_DIVISION, t[0]), t[1])
            })
        })
    })

    describe('multiply by inverse', () => {
        const tests = [
            ['2 / (3 / 4)', '2 * 4 / 3'],
            ['x / (2 / 2)', 'x * 2 / 2'],
            ['(x + 1) / (2 / (x + 1))', '(x + 1) * (x + 1) / 2'],
            ['x^((x + 1) / (2 / 2))', 'x^((x + 1) * 2 / 2)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert(canApplyRule(rules.MULTIPLY_BY_INVERSE, parse(t[0])))
                assert.equal(applyRuleString(rules.MULTIPLY_BY_INVERSE, t[0]), t[1])
            })
        })
    })

    describe('absolute value', () => {
        const tests = [
            ['|-2|', '2'],
            ['|-x|', 'x'],
            ['|-(x + 1)|', 'x + 1'],
            ['x^(|-(x + 1)|)', 'x^(x + 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.ABSOLUTE_VALUE, t[0]), t[1])
            })
        })
    })

    describe('collects like terms', () => {
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
            it(`${t[0]} => ${t[1]}`, () => {
                const ast = parse(t[0])
                const result = print(applyRule(collectLikeTermsRule, parse(t[0])))
                assert.equal(result, t[1])
            })
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

    describe('product rule', () => {
        const tests = [
            ['10^2 * 10^5 * 10^3', '10^(2 + 5 + 3)'],
            ['x^a * x^b * x^c', 'x^(a + b + c)'],
            ['x^a * x^(b+c) * x^(d*e)', 'x^(a + (b + c) + d * e)'],
            // TODO: update match to handle this case
            // ['5 * 10^2 * 10^5 * 10^3', '5 * 10^(2 + 5 + 3)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.PRODUCT_RULE, t[0]), t[1])
            })
        })
    })

    describe('quotient rule', () => {
        const tests = [
            ['x^5 / x^3', 'x^(5 - 3)'],
            ['x^-a / x^-b', 'x^(-a - -b)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.QUOTIENT_RULE, t[0]), t[1])
            })
        })
    })

    describe('power of a product', () => {
        const tests = [
            ['(2*3)^x', '2^x * 3^x'],
            ['(2*3*5)^x', '2^x * 3^x * 5^x'],
            ['(a*b*c*d)^x', 'a^x * b^x * c^x * d^x'],
            ['(p*q)^(x+y)', 'p^(x + y) * q^(x + y)'],
            ['(p*q)^(x-y)', 'p^(x - y) * q^(x - y)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.POWER_OF_A_PRODUCT, t[0]), t[1])
            })
        })
    })

    describe('power of a quotient', () => {
        const tests = [
            ['(5 / 3)^x', '5^x / 3^x'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.POWER_OF_A_QUOTIENT, t[0]), t[1])
            })
        })
    })

    describe('break up fraction', () => {
        const tests = [
            ['(a + b) / 2', 'a / 2 + b / 2'],
            ['(a + b + c) / 2', 'a / 2 + b / 2 + c / 2'],
            ['(a + b) / (2n)', 'a / (2 n) + b / (2 n)'],
            ['(a + b) / (x+y)', 'a / (x + y) + b / (x + y)'],
            ['(a - b) / 2', 'a / 2 - b / 2'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.BREAK_UP_FRACTION, t[0]), t[1])
            })
        })
    })

    describe('distribute', () => {
        const tests = [
            ['2 * (x + 1)', '2 * x + 2 * 1'],
            ['2 * (x - 1)', '2 * x - 2 * 1'],
            ['(a + b) * (x + y)', '(a + b) * x + (a + b) * y'],
            ['(a - b) * (x - y)', '(a - b) * x - (a - b) * y'],
            ['2 * (x + 1) - 3 * (y - 1)', '(2 * x + 2 * 1) - 3 * (y - 1)'],
            ['1 - 3 * (y - 1)', '1 - (3 * y - 3 * 1)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.DISTRIBUTE, t[0]), t[1])
            })
        })
    })

    describe('distribute right', () => {
        const tests = [
            ['(x + 1) * 2', 'x * 2 + 1 * 2'],
            ['(x - 1) * 2', 'x * 2 - 1 * 2'],
            ['(a + b) * (x + y)', 'a * (x + y) + b * (x + y)'],
            ['(a - b) * (x - y)', 'a * (x - y) - b * (x - y)'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.DISTRIBUTE_RIGHT, t[0]), t[1])
            })
        })
    })

    describe('distribute negative one', () => {
        // TODO: remove multiplication by negative one
        const tests = [
            ['-(x + 1)', '-1 * x + -1 * 1'],
            ['-(x - 1)', '-1 * x - -1 * 1'],
            ['-(a + b + c)', '-1 * a + -1 * b + -1 * c'],
        ]

        tests.forEach(t => {
            it(`${t[0]} => ${t[1]}`, () => {
                assert.equal(applyRuleString(rules.DISTRIBUTE_NEGATIVE_ONE, t[0]), t[1])
            })
        })
    })


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
