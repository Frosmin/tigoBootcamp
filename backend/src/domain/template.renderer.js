import { DeliveryError } from '../delivery/delivery.error.js';

export const renderTemplate = (content, variables) => {
  let rendered = content;
  for (const [name, value] of Object.entries(variables)) {
    rendered = rendered.split(`{{${name}}}`).join(String(value));
  }

  if (/{{[^{}]+}}/.test(rendered)) {
    throw new DeliveryError(
      'TEMPLATE_RENDER_ERROR',
      'Template contains unresolved variables',
      false
    );
  }
  return rendered;
};
