import { type ComboboxOption, MultiCombobox } from '@grafana/ui';
import React, { useCallback } from 'react';
import { type SearchAnnotationTags } from './annotationTagsContext';

interface Props {
  id?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  searchTags: SearchAnnotationTags;
  /** True when the user cannot change the tags. */
  disabled?: boolean;
}

/**
 * The tags of the annotation editor, with the existing tags as suggestions, as core `TagFilter`. The user can
 * also type a new tag. If the search fails, the list shows no suggestions and a new tag is still possible.
 * The list opens in a portal, out of the editor element.
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-multicombobox--docs
 */
export const AnnotationTagsSelect: React.FC<Props> = ({ id, tags, onChange, searchTags, disabled }) => {
  const options = useCallback(
    async (query: string): Promise<Array<ComboboxOption<string>>> => {
      try {
        const found = await searchTags(query);
        return found.map((tag) => ({ label: tag, value: tag }));
      } catch {
        return [];
      }
    },
    [searchTags]
  );

  return (
    <MultiCombobox<string>
      id={id}
      placeholder="Add tags"
      disabled={disabled}
      createCustomValue
      customValueDescription="New tag"
      options={options}
      value={tags}
      onChange={(selected) => onChange(selected.map((option) => option.value))}
    />
  );
};
