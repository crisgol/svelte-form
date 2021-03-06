import typeDetect from 'type-detect'
import Ajv, { ErrorObject } from 'ajv'
import { FieldProps, JSONObject, JSONSchema, JSONSchemaType, ErrorRecord, Errors } from './types'

export function createProps<
  T extends JSONSchemaType,
  E extends Errors = ErrorObject[]
>(): FieldProps<T, E> {
  const props: FieldProps<T, E> = {
    value: null,
    errors: null
  }

  return props
}

export function objectDefaultValue(schema: JSONSchema, value: JSONObject | null): JSONObject {
  const v: JSONObject = {}
  const { properties } = schema
  if (properties) {
    for (let k in properties) {
      const propSchema = properties[k]

      if (typeof propSchema !== 'boolean') {
        const item = value && value[k]
        v[k] = defaultValue(propSchema, item)
      }
    }
  }
  return v
}

export function defaultValue(schema: JSONSchema, value: JSONSchemaType): JSONSchemaType {
  if (value === null && schema.default !== undefined) {
    value = schema.default
  }

  if (schema.type === 'object') {
    return objectDefaultValue(schema, <JSONObject>value)
  }

  return value
}

export function normalizeObject(value: JSONObject, isRoot = true): JSONObject | null {
  const obj: JSONObject = {}
  for (const k in value) {
    let v = value[k]
    v = typeDetect(v) === 'Object' ? normalizeObject(v as JSONObject, false) : v
    if (v !== null) {
      obj[k] = v
    }
  }
  return Object.keys(obj).length ? obj : isRoot ? {} : null
}

export function normalizeValue(value: JSONSchemaType): JSONSchemaType {
  return typeDetect(value) === 'Object' ? normalizeObject(value as JSONObject) : value
}

const ajv = new Ajv({ allErrors: true })
export function validate(schema: JSONSchema, data: JSONSchemaType) {
  const valid = ajv.validate(schema, data) as boolean
  if (!valid) {
    return ajv.errors as Ajv.ErrorObject[]
  }
  return null
}

export function errorsToMap(errors: ErrorObject[]): ErrorRecord {
  const errorMap: ErrorRecord = {}
  return errors
    .map(
      (error): [string[], ErrorObject] => {
        const pathSuffix =
          error.keyword === 'required'
            ? `.${(<Ajv.RequiredParams>error.params).missingProperty}`
            : ''
        const path = `${error.dataPath}${pathSuffix}`.split('.').slice(1)
        return [path, error]
      }
    )
    .reduce((acc, [path, error]) => {
      path.reduce((obj, key, i, arr) => {
        // build tree
        if (i !== arr.length - 1) {
          return (obj[key] ? obj[key] : (obj[key] = obj[key] || {})) as ErrorRecord
        }

        // add error
        if (obj[key]) {
          ;(obj[key] as ErrorObject[]).push(error)
        } else {
          obj[key] = [error]
        }

        return obj
      }, acc)
      return acc
    }, errorMap)
}
