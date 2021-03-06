import assert from 'assert'
import {parse, print} from 'math-parser'

import {flattenOperands} from '../utils'

const test = (input, output) =>
    it(input, () => {
        assert.equal(print(flattenOperands(parse(input))), output)
    })

describe('flattenOperands', () => {
    describe('addition', () => {
        test('(1 * 2) * (3 * 4)', '1 * 2 * 3 * 4')
        test('(1 * (2 * (3 * 4)))', '1 * 2 * 3 * 4')
        test('(((1 * 2) * 3) * 4)', '1 * 2 * 3 * 4')
        test('x^(1 * (2 * (3 * 4)))', 'x^(1 * 2 * 3 * 4)')
        test('x^(((1 * 2) * 3) * 4)', 'x^(1 * 2 * 3 * 4)')
    })

    describe('multiplication', () => {
        test('(1 * 2) * (3 * 4)', '1 * 2 * 3 * 4')
        test('(1 * (2 * (3 * 4)))', '1 * 2 * 3 * 4')
        test('(((1 * 2) * 3) * 4)', '1 * 2 * 3 * 4')
        test('x^(1 * (2 * (3 * 4)))', 'x^(1 * 2 * 3 * 4)')
        test('x^(((1 * 2) * 3) * 4)', 'x^(1 * 2 * 3 * 4)')
    })
})
