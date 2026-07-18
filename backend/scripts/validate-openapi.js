import SwaggerParser from '@apidevtools/swagger-parser';

await SwaggerParser.validate('docs/openapi.yaml');
console.log('OpenAPI docs/openapi.yaml: valid');
