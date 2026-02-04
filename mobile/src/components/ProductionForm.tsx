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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
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
  // Required check
  if (field.required && (value === null || value === '' || value === undefined)) {
    return `${field.label} é obrigatório`;
  }

  if (value === null || value === '') return null;

  const validation = field.validation;
  if (!validation) return null;

  // Number validations
  if (field.type === FormFieldType.NUMBER && typeof value === 'number') {
    if (validation.min !== null && value < validation.min) {
      return `Valor mínimo: ${validation.min}`;
    }
    if (validation.max !== null && value > validation.max) {
      return `Valor máximo: ${validation.max}`;
    }
  }

  // Text validations
  if (typeof value === 'string') {
    if (validation.minLength !== null && value.length < validation.minLength) {
      return `Mínimo ${validation.minLength} caracteres`;
    }
    if (validation.maxLength !== null && value.length > validation.maxLength) {
      return `Máximo ${validation.maxLength} caracteres`;
    }
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        return validation.patternMessage || 'Formato inválido';
      }
    }
  }

  return null;
}

// ============================================
// COMPONENT
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
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleChange = useCallback((fieldName: string, value: string | number | null) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    // Clear error on change
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
      // Reset form on success
      setValues(getInitialValues(sortedFields));
      setCompletionDate(new Date());
    } catch (error) {
      Alert.alert('Erro', 'Falha ao enviar produção. Será salvo para retry automático.');
    }
  }, [validateForm, jobId, completionDate, values, onSubmit, sortedFields]);

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
        return (
          <View key={field.id} style={styles.fieldContainer}>
            <Text style={styles.label}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
            </Text>
            <View style={[styles.pickerContainer, hasError && styles.inputError]}>
              <Picker
                selectedValue={values[field.name]}
                onValueChange={(value) => handleChange(field.name, value)}
                enabled={!disabled && !isSubmitting}
                style={styles.picker}
              >
                <Picker.Item label="Selecione..." value="" />
                {field.options?.map((option) => (
                  <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Picker>
            </View>
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
            <TouchableOpacity
              style={[styles.input, styles.dateInput, hasError && styles.inputError]}
              onPress={() => setShowDatePicker(true)}
              disabled={disabled || isSubmitting}
            >
              <Text style={styles.dateText}>
                {values[field.name]
                  ? new Date(values[field.name] as string).toLocaleDateString('pt-BR')
                  : 'Selecione uma data'}
              </Text>
            </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowDatePicker(true)}
            disabled={disabled || isSubmitting}
          >
            <Text style={styles.dateText}>
              {completionDate.toLocaleDateString('pt-BR')}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={completionDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, date) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (date) setCompletionDate(date);
            }}
            maximumDate={new Date()}
          />
        )}

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

  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },

  dateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#111827',
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
});
