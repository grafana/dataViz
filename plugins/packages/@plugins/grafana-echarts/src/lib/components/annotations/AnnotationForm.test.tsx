import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
// jsdom has no `IntersectionObserver`, which the list of `MultiCombobox` uses.
import { stubIntersectionObserver } from 'test/intersectionObserver';
import { AnnotationForm } from './AnnotationForm';
import { AnnotationTagsContext, type SearchAnnotationTags } from './annotationTagsContext';

beforeAll(stubIntersectionObserver);

// The `locked` state of the form: the standalone renderer locks the form while a save has no result.

const draft = { from: 1000, to: 1000, position: { x: 10, y: 10 } };
const searchTags: SearchAnnotationTags = () => Promise.resolve(['deploy']);

const renderForm = (locked: boolean, search?: SearchAnnotationTags) => {
  const onCancel = jest.fn();
  render(
    <AnnotationTagsContext.Provider value={search}>
      <AnnotationForm
        draft={draft}
        timeZone="utc"
        description="Deploy"
        tags={['release']}
        saving={locked}
        locked={locked}
        onChange={jest.fn()}
        onSave={jest.fn()}
        onCancel={onCancel}
      />
    </AnnotationTagsContext.Provider>
  );
  return { onCancel };
};

describe('a locked AnnotationForm', () => {
  it.each<[string, SearchAnnotationTags | undefined]>([
    ['free text tags', undefined],
    ['a tag search', searchTags],
  ])('disables the description, the tags, Cancel, Close and Save with %s', (_name, search) => {
    renderForm(true, search);
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeDisabled();
    expect(screen.getByLabelText('Tags')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
  });

  it('does not call onCancel on the Escape key', () => {
    const { onCancel } = renderForm(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('an AnnotationForm that is not locked', () => {
  it.each<[string, SearchAnnotationTags | undefined]>([
    ['free text tags', undefined],
    ['a tag search', searchTags],
  ])('enables each field with %s, and Escape calls onCancel', (_name, search) => {
    const { onCancel } = renderForm(false, search);
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeEnabled();
    expect(screen.getByLabelText('Tags')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
