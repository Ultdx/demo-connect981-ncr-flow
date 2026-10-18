import { workflowLabels } from './workflowPresentation';

export class Presentation {
  static count(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`;
  }
  static label(value: string): string {
    return (
      workflowLabels.get(value) ??
      value
        .toLowerCase()
        .replaceAll('_', ' ')
        .replace(/^./, (letter) => letter.toUpperCase())
    );
  }
  static date(value: string): string {
    return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
}
