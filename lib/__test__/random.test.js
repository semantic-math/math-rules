import {getCoefficient, isPolynomialTerm, getCoefficientsAndConstants, getVariableFactors, getVariableFactorName} from '../rules/collect-like-terms.js'
import {parse, print} from 'math-parser'

//console.log(print(getCoefficient(parse('2/3x'))))
console.log(getCoefficientsAndConstants(parse('2/3(x+1)^2 + 2'))['coefficientMap'])
//console.log(getVariableFactorName(parse('(xyz)^2')))
