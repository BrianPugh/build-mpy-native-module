import { Config, Architecture, SingleArchitecture } from './types';
export declare class ValidationError extends Error {
    constructor(message: string);
}
export declare function supportsRv32imc(micropythonVersion: string): boolean;
export declare function resolveArchitectures(architecture: Architecture, micropythonVersion: string): SingleArchitecture[];
export declare function validateInputs(): Config;
