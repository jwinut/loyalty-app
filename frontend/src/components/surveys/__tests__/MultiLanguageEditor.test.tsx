/* eslint-disable @typescript-eslint/no-non-null-assertion -- Test file uses non-null assertions for DOM element access */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MultiLanguageEditor from '../MultiLanguageEditor';

// Mock react-icons
vi.mock('react-icons/fi', () => ({
  FiGlobe: () => <span data-testid="globe-icon">🌐</span>,
  FiPlus: () => <span data-testid="plus-icon">+</span>,
  FiTrash2: () => <span data-testid="trash-icon">🗑</span>,
  FiCheck: () => <span data-testid="check-icon">✓</span>,
}));

describe('MultiLanguageEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render the component', () => {
      const { container } = render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(container).toBeTruthy();
    });

    it('should render without crashing', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByText('Question Text')).toBeInTheDocument();
    });

    it('should display the label', () => {
      render(
        <MultiLanguageEditor
          value={{ en: '' }}
          onChange={mockOnChange}
          label="Survey Title"
        />
      );

      expect(screen.getByText('Survey Title')).toBeInTheDocument();
    });

    it('should show required asterisk when required is true', () => {
      render(
        <MultiLanguageEditor
          value={{ en: '' }}
          onChange={mockOnChange}
          label="Question Text"
          required={true}
        />
      );

      const asterisk = screen.getByText('*');
      expect(asterisk).toBeInTheDocument();
      expect(asterisk).toHaveClass('text-red-500');
    });

    it('should not show required asterisk when required is false', () => {
      render(
        <MultiLanguageEditor
          value={{ en: '' }}
          onChange={mockOnChange}
          label="Question Text"
          required={false}
        />
      );

      expect(screen.queryByText('*')).not.toBeInTheDocument();
    });

    it('should default to text input type', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Test' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const input = screen.getByDisplayValue('Test');
      expect(input.tagName).toBe('INPUT');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render textarea when type is textarea', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Test' }}
          onChange={mockOnChange}
          label="Description"
          type="textarea"
        />
      );

      const textarea = screen.getByDisplayValue('Test');
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  describe('Language Tab Switching', () => {
    it('should render English tab by default', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('should set English as active tab by default', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const englishTab = screen.getByText('English').closest('button');
      expect(englishTab).toHaveClass('bg-brand-50', 'text-brand-700');
    });

    it('should switch active tab when clicked', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiTab);

      expect(thaiTab).toHaveClass('bg-brand-50', 'text-brand-700');
    });

    it('should display content for active tab', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiTab);

      expect(screen.getByDisplayValue('สวัสดี')).toBeInTheDocument();
    });

    it('should show all enabled language tabs', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี', zh: '你好' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('ไทย (Thai)')).toBeInTheDocument();
      expect(screen.getByText('中文 (Chinese)')).toBeInTheDocument();
    });

    it('should display language flags in tabs', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByText('🇺🇸')).toBeInTheDocument();
      expect(screen.getByText('🇹🇭')).toBeInTheDocument();
    });
  });

  describe('Content Editing', () => {
    it('should call onChange when text is edited', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const input = screen.getByDisplayValue('Hello');
      await user.clear(input);
      await user.type(input, 'Hi there');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should update text for current language only', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const input = screen.getByDisplayValue('Hello');
      await user.clear(input);
      await user.type(input, 'Hi');

      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]![0];
      expect(lastCall.en).toBe('Hi');
      expect(lastCall.th).toBe('สวัสดี');
    });

    it('should edit content in different languages independently', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiTab);

      const input = screen.getByDisplayValue('สวัสดี');
      await user.clear(input);
      await user.type(input, 'หวัดดี');

      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]![0];
      expect(lastCall.th).toBe('หวัดดี');
      expect(lastCall.en).toBe('Hello');
    });

    it('should handle textarea input', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Description"
          type="textarea"
        />
      );

      const textarea = screen.getByDisplayValue('Hello');
      await user.clear(textarea);
      await user.type(textarea, 'Multi\nline\ntext');

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should display placeholder when field is empty', () => {
      render(
        <MultiLanguageEditor
          value={{ en: '' }}
          onChange={mockOnChange}
          label="Question Text"
          placeholder="Enter question"
        />
      );

      const input = screen.getByPlaceholderText('Enter question (English)');
      expect(input).toBeInTheDocument();
    });

    it('should update placeholder based on active language', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: '', th: '' }}
          onChange={mockOnChange}
          label="Question Text"
          placeholder="Enter text"
        />
      );

      expect(screen.getByPlaceholderText('Enter text (English)')).toBeInTheDocument();

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiTab);

      expect(screen.getByPlaceholderText('Enter text (ไทย (Thai))')).toBeInTheDocument();
    });
  });

  describe('Adding Languages', () => {
    it('should show add language button when not all languages are enabled', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
      expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
    });

    it('should not show add language button when all languages are enabled', () => {
      render(
        <MultiLanguageEditor
          value={{
            en: 'Hello',
            th: 'สวัสดี',
            zh: '你好',
            ja: 'こんにちは',
            ko: '안녕하세요',
            es: 'Hola',
            fr: 'Bonjour',
            de: 'Hallo',
          }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const addButton = screen.queryByTestId('plus-icon');
      expect(addButton).not.toBeInTheDocument();
    });

    it('should show language selector dropdown when add button clicked', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const addButton = screen.getByTestId('plus-icon').closest('button') as HTMLElement;
      await user.click(addButton);

      expect(screen.getByText('Add Language:')).toBeInTheDocument();
    });

    it('should display available languages in dropdown', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const addButton = screen.getByTestId('plus-icon').closest('button') as HTMLElement;
      await user.click(addButton);

      expect(screen.getByText('ไทย (Thai)')).toBeInTheDocument();
      expect(screen.getByText('中文 (Chinese)')).toBeInTheDocument();
      expect(screen.getByText('日本語 (Japanese)')).toBeInTheDocument();
    });

    it('should add language when selected from dropdown', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const addButton = screen.getByTestId('plus-icon').closest('button') as HTMLElement;
      await user.click(addButton);

      const thaiOption = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiOption);

      expect(mockOnChange).toHaveBeenCalledWith({
        en: 'Hello',
        th: 'Hello',
      });
    });

    it('should switch to newly added language tab', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const addButton = screen.getByTestId('plus-icon').closest('button') as HTMLElement;
      await user.click(addButton);

      const thaiOption = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiOption);

      rerender(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button');
      expect(thaiTab).toHaveClass('bg-brand-50', 'text-brand-700');
    });

    it('should close dropdown after adding language', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const addButton = screen.getByTestId('plus-icon').closest('button') as HTMLElement;
      await user.click(addButton);

      expect(screen.getByText('Add Language:')).toBeInTheDocument();

      const thaiOption = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiOption);

      await waitFor(() => {
        expect(screen.queryByText('Add Language:')).not.toBeInTheDocument();
      });
    });

    it('should copy English text to new language by default', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello World' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const addButton = screen.getByTestId('plus-icon').closest('button') as HTMLElement;
      await user.click(addButton);

      const frenchOption = screen.getByText('Français').closest('button') as HTMLElement;
      await user.click(frenchOption);

      expect(mockOnChange).toHaveBeenCalledWith({
        en: 'Hello World',
        fr: 'Hello World',
      });
    });
  });

  describe('Removing Languages', () => {
    it('should show remove button for non-English languages', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      const removeIcon = thaiTab.querySelector('[data-testid="trash-icon"]');
      expect(removeIcon).toBeInTheDocument();
    });

    it('should not show remove button for English language', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const englishTab = screen.getByText('English').closest('button') as HTMLElement;
      const removeIcon = englishTab.querySelector('[data-testid="trash-icon"]');
      expect(removeIcon).not.toBeInTheDocument();
    });

    it('should remove language when remove button clicked', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี', zh: '你好' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      const removeButton = thaiTab.querySelector('[data-testid="trash-icon"]')?.closest('button') as HTMLElement;

      await user.click(removeButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        en: 'Hello',
        zh: '你好',
      });
    });

    it('should switch to English tab when removing active language', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiTab);

      expect(thaiTab).toHaveClass('bg-brand-50', 'text-brand-700');

      const removeButton = thaiTab.querySelector('[data-testid="trash-icon"]')?.closest('button') as HTMLElement;
      await user.click(removeButton);

      rerender(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const englishTab = screen.getByText('English').closest('button');
      expect(englishTab).toHaveClass('bg-brand-50', 'text-brand-700');
    });
  });

  describe('Copy from English Feature', () => {
    it('should show copy from English button for non-English tabs', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: '' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiTab);

      expect(screen.getByText('Copy from English')).toBeInTheDocument();
    });

    it('should not show copy from English button on English tab', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.queryByText('Copy from English')).not.toBeInTheDocument();
    });

    it('should copy English text when copy button clicked', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello World', th: '' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiTab);

      const copyButton = screen.getByText('Copy from English');
      await user.click(copyButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        en: 'Hello World',
        th: 'Hello World',
      });
    });

    it('should not show copy button when English value is empty', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: '', th: '' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiTab);

      expect(screen.queryByText('Copy from English')).not.toBeInTheDocument();
    });
  });

  describe('Translation Status Display', () => {
    it('should show translation count', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี', zh: '' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByText(/Translations: 2 \/ 3/)).toBeInTheDocument();
    });

    it('should show status indicators for each language', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี', zh: '' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const indicators = document.querySelectorAll('.w-2.h-2.rounded-full');
      expect(indicators.length).toBeGreaterThan(0);
    });

    it('should show green indicator for translated languages', () => {
      const { container } = render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const greenIndicators = container.querySelectorAll('.bg-green-400');
      expect(greenIndicators.length).toBeGreaterThan(0);
    });

    it('should show gray indicator for missing translations', () => {
      const { container } = render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: '' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const grayIndicators = container.querySelectorAll('.bg-stone-300');
      expect(grayIndicators.length).toBeGreaterThan(0);
    });

    it('should show check mark icon for completed translations', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const checkIcons = screen.getAllByTestId('check-icon');
      expect(checkIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Editing Indicator', () => {
    it('should show currently editing language', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByText(/Editing: 🇺🇸 English/)).toBeInTheDocument();
    });

    it('should update editing indicator when switching tabs', async () => {
      const user = userEvent.setup();
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: 'สวัสดี' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByText(/Editing: 🇺🇸 English/)).toBeInTheDocument();

      const thaiTab = screen.getByText('ไทย (Thai)').closest('button') as HTMLElement;
      await user.click(thaiTab);

      expect(screen.getByText(/Editing: 🇹🇭 ไทย \(Thai\)/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty value object', () => {
      render(
        <MultiLanguageEditor
          value={{}}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByText('English')).toBeInTheDocument();
    });

    it('should handle very long text content', async () => {
      const longText = 'A'.repeat(500);
      render(
        <MultiLanguageEditor
          value={{ en: longText }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const input = screen.getByDisplayValue(longText);
      expect(input).toBeInTheDocument();
    });

    it('should handle special characters in translations', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello & "World" <test>' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByDisplayValue('Hello & "World" <test>')).toBeInTheDocument();
    });

    it('should handle whitespace-only values as empty', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Hello', th: '   ' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      expect(screen.getByText(/Translations: 1 \/ 2/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper label structure', () => {
      render(
        <MultiLanguageEditor
          value={{ en: '' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const label = screen.getByText('Question Text');
      expect(label.tagName).toBe('LABEL');
    });

    it('should have proper focus styles on input', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Test' }}
          onChange={mockOnChange}
          label="Question Text"
        />
      );

      const input = screen.getByDisplayValue('Test');
      expect(input).toHaveClass('focus:ring-2', 'focus:ring-brand-500');
    });

    it('should have proper focus styles on textarea', () => {
      render(
        <MultiLanguageEditor
          value={{ en: 'Test' }}
          onChange={mockOnChange}
          label="Description"
          type="textarea"
        />
      );

      const textarea = screen.getByDisplayValue('Test');
      expect(textarea).toHaveClass('focus:ring-2', 'focus:ring-brand-500');
    });
  });
});
