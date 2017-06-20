import assert from 'assert'
import {parse, print, evaluate} from 'math-parser'

import {applyRule, canApplyRule} from '../rule'
import * as factor_rules from '../factor-rules'

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

suite('factor symbol', factor_rules.FACTOR_SYMBOL, [
    //['x^2 + x^5 + x^16', ''],
    //['x^2 - x^5 - x^16', ''],
])

suite('factor difference of squares helper', factor_rules.FACTOR_DIFFERENCE_OF_SQUARES_HELPER, [
    ['4(xy)^2 - 16x^2', '(2 xy^1)^2 - (4 x^1)^2'],
    ['1 x^2 - 1 y^2', '(1 x^1)^2 - (1 y^1)^2']
])

suite('factor difference of squares', factor_rules.FACTOR_DIFFERENCE_OF_SQUARES, [
    ['(2x)^2 - (3y)^2', '(2 x + 3 y) (2 x - 3 y)'],
    ['(1 x^1)^2 - (1 y^1)^2', '(1 x^1 + 1 y^1) (1 x^1 - 1 y^1)']
])

suite('factor perfect squares', factor_rules.FACTOR_PERFECT_SQUARE_TRINOMIALS, [
    ['4x^2 + 12x^1 + 9', '(2 x^1 + 3)^2'],
    ['4x^4 - 12x^2 + 9', '(2 x^2 - 3)^2'],
    ['4x^2 - 12x^1y^1 + 9y^2', '(2 x^1 - 3 y^1)^2'],
    ['1a^2 + 2a^1 b^1 + 1b^2', '(1 a^1 + 1 b^1)^2'],
    ['1x^2 + 10x^1 + 25', '(1 x^1 + 5)^2'],
    // TODO: handle this case
    //['1x^2 + bx + (b/2)^4', '(x + b/2)^2']
])

suite('rearrange terms', factor_rules.REARRANGE_TERMS, [
    ['2 + 3x', '3 x + 2'],
    ['4 + 3x^2 + 2x', '3 x^2 + 2 x + 4'],
    ['3x - 2x^4 + 2x', '-2 x^4 + 3 x + 2 x'],
    ['9 + 12x^2 + 4x^4', '4 x^4 + 12 x^2 + 9']
])

suite('factor sum product rule', factor_rules.FACTOR_SUM_PRODUCT_RULE, [
    // 1
    ['4x^4 + 12x^2 + 9','(2 x^2 + 3) (2 x^2 + 3)'],
    // 2
    ['6x^4 + 13x^2 + 6', '(2 x^2 + 3) (3 x^2 + 2)'],
    // 3
    ['2x^4 - 7x^2 + 6', '(1 x^2 - 2) (2 x^2 - 3)'],
    // 4
    ['6x^2 - 13x^1 + 6', '(2 x^1 - 3) (3 x^1 - 2)'],
    // 5
    ['2x^4 - 1x^2 - 6', '(1 x^2 - 2) (2 x^2 + 3)'],
    // 6
    ['6x^4 + 7x^2 - 3', '(2 x^2 + 3) (3 x^2 - 1)'],
    // 7
    ['2x^4 + 1x^2 - 6', '(1 x^2 + 2) (2 x^2 - 3)'],
    // 8
    ['6x^4 - 7x^2 - 3', '(2 x^2 - 3) (3 x^2 + 1)'],
    // TODO: handle this case
    //['4x^2y^2 + 12a^2b^2x^1y^1 + 9x^b^4', ''],
    ['4a^2b^2 + 12a^1b^1x^1y^2 + 9x^2y^4', '(2 a^1 b^1 + 3 x^1 y^2) (2 a^1 b^1 + 3 x^1 y^2)'],
    ['12x^2 + 17 x^1 y^1 + 6y^2', '(3 x^1 + 2 y^1) (4 x^1 + 3 y^1)'],
    ['12x^2 + 17x^1 + 6', '(3 x^1 + 2) (4 x^1 + 3)'],
    ['4x^2 + 12x^1 + 9', '(2 x^1 + 3) (2 x^1 + 3)'],
])
