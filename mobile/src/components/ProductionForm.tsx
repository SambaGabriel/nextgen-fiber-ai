/**
 * NextGen Fiber - ProductionForm Component
 * Dynamic form for production submission
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import {
  FormSchema,
  FormField,
  FormFieldType,
  CreateSubmissionPayload,
} from '../types/jobs';

// ============================================
// TYPES
// ============================================

interface ProductionFormProps {
  formSchema: FormSchema;
  jobId: string;
  onSubmit: (payload: CreateSubmissionPayload) => Promise<void>;
  isSubmitting?: boolean;
  disabled?: boolean;
}

type FormValues = Record<string, string | number | null>;
type FormErrors = Record<string, string>;

// ============================================
// HELPERS
// ============================================

function getInitialValues(fields: FormField[]): FormValues {
  const values: FormValues = {};
  fields.forEach((field) => {
    values[field.name] = field.defaultValue ?? (field.type === FormFieldType.NUMBER ? null : '');
  });
  return values;
}

function validateField(field: FormField, value: string | number | null): string | null {
  if (field.required && (value === null || value === '' || value === undefined)) {
    return `${field.label} é obrigatório`;
  }

  if (value === null || value === '') return null;

  const validation = field.validation;
  if (!validation) return null;

  if (field.type === FormFieldType.NUMBER && typeof value === 'number') {
    if (validation.min !== null && value < validation.min) {
      return `Valor mínimo: ${validation.min}`;
    }
    if (validation.max !== null && value > validation.max) {
      return `Valor máximo: ${validation.max}`;
    }
  }

  if (typeof value === 'string') {
    if (validation.minLength !== null && value.length < validation.minLength) {
      return `Mínimo ${validation.minLength} caracteres`;
    }
    if (validation.maxLength !== null && value.length > validation.maxLength) {
      return `Máximo ${validation.maxLength} caracteres`;
    }
  }

  return null;
}

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// ============================================
// SELECT MODAL COMPONENT
// ============================================

interface SelectModalProps {
  visible: boolean;
  options: { value: string; label: string }[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  title: string;
}

function SelectModal({ visible, options, selectedValue, onSelect, onClose, title }: SelectModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  selectedValue === item.value && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  onSelect(item.value);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selectedValue === item.value && styles.modalOptionTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ProductionForm({
  formSchema,
  jobId,
  onSubmit,
  isSubmitting = false,
  disabled = false,
}: ProductionFormProps): JSX.Element {
  const sortedFields = useMemo(
    () => [...formSchema.fields].sort((a, b) => a.order - b.order),
    [formSchema.fields]
  );

  const [values, setValues] = useState<FormValues>(() => getInitialValues(sortedFields));
  const [errors, setErrors] = useState<FormErrors>({});
  const [completionDate, setCompletionDate] = useState(new Date());
  const [dateText, setDateText] = useState(formatDate(new Date()));
  const [selectModalField, setSelectModalField] = useState<FormField | null>(null);

  const handleChange = useCallback((fieldName: string, value: string | number | null) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    sortedFields.forEach((field) => {
      const error = validateField(field, values[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [sortedFields, values]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) {
      Alert.alert('Erro', 'Por favor, corrija os campos destacados');
      return;
    }

    const payload: CreateSubmissionPayload = {
      jobId,
      completionDate: completionDate.toISOString().split('T')[0],
      formData: values,
    };

    try {
      await onSubmit(payload);
      setValues(getInitialValues(sortedFields));
      setCompletionDate(new Date());
      setDateText(formatDate(new Date()));
    } catch (error) {
      Alert.alert('Erro', 'Falha ao enviar produção. Será salvo para retry automático.');
    }
  }, [validateForm, jobId, completionDate, values, onSubmit, sortedFields]);

  const handleDateChange = (text: string) => {
    setDateText(text);
    // Try to parse DD/MM/YYYY format
    const parts = text.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          setCompletionDate(date);
        }
      }
    }
  };

  const renderField = (field: FormField) => {
    const error = errors[field.name];
    const hasError = !!error;

    switch (field.type) {
      case FormFieldType.TEXT:
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.input, hasError && styles.inputError]}
              value={String(values[field.name] || '')}
              onChangeText={(text) => handleChange(field.name, text)}
              placeholder={field.placeholder || ''}
              placeholderTextColor="#9CA3AF"
              editable={!disabled && !isSubmitting}
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
            {hasError && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case FormFieldType.NUMBER:
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.input, hasError && styles.inputError]}
              value={values[field.name] !== null ? String(values[field.name]) : ''}
              onChangeText={(text) => {
                const num = text === '' ? null : parseFloat(text);
                handleChange(field.name, isNaN(num as number) ? null : num);
              }}
              placeholder={field.placeholder || ''}
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              editable={!disabled && !isSubmitting}
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
            {hasError && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case FormFieldType.TEXTAREA:
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, hasError && styles.inputError]}
              value={String(values[field.name] || '')}
              onChangeText={(text) => handleChange(field.name, text)}
              placeholder={field.placeholder || ''}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!disabled && !isSubmitting}
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
            {hasError && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case FormFieldType.SELECT:
        const selectedOption = field.options?.find((o) => o.value === values[field.name]);
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TouchableOpacity
              style={[styles.input, styles.selectInput, hasError && styles.inputError]}
              onPress={() => setSelectModalField(field)}
              disabled={disabled || isSubmitting}
            >
              <Text style={selectedOption ? styles.selectText : styles.selectPlaceholder}>
                {selectedOption ? selectedOption.label : 'Selecione...'}
              </Text>
              <Text style={styles.selectArrow}>▼</Text>
            </TouchableOpacity>
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
            {hasError && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case FormFieldType.DATE:
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <TextInput
              style={[styles.input, hasError && styles.inputError]}
              value={String(values[field.name] || '')}
              onChangeText={(text) => handleChange(field.name, text)}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              editable={!disabled && !isSubmitting}
            />
            {field.helpText && <Text style={styles.helpText}>{field.helpText}</Text>}
            {hasError && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Completion Date */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>
            Data de Conclusão <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={dateText}
            onChangeText={handleDateChange}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            editable={!disabled && !isSubmitting}
          />
        </View>

        {/* Dynamic Fields */}
        {sortedFields.map(renderField)}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (disabled || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={disabled || isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Enviando...' : 'Enviar Produção'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Select Modal */}
      {selectModalField && (
        <SelectModal
          visible={true}
          title={selectModalField.label}
          options={selectModalField.options || []}
          selectedValue={values[selectModalField.name] as string | null}
          onSelect={(value) => handleChange(selectModalField.name, value)}
          onClose={() => setSelectModalField(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  required: {
    color: '#EF4444',
  },
  helpText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  textArea: {
    minHeight: 100,
  },

  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: 16,
    color: '#111827',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  selectArrow: {
    fontSize: 12,
    color: '#6B7280',
  },

  submitButton: {
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 34,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalOptionTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});
