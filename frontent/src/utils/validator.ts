import { validate as uuidValidate } from "uuid";

export function isUuid(value: string): boolean {
  return uuidValidate(value);
}
