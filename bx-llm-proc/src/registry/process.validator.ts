import Ajv from 'ajv';
import schema from './process.schema.json';
import processes from './processes.json';

export function validateProcessRegistry() {
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  const validate = ajv.compile(schema as any);
  const ok = validate(processes as any);
  if (!ok) {
    const message = ajv.errorsText(validate.errors, { separator: '\n' });
    throw new Error(`Invalid processes.json:\n${message}`);
  }
  return true;
}

export default validateProcessRegistry;
