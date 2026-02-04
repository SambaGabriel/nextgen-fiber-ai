/**
 * SafetyChecklist - Mandatory safety verification before starting work
 * Must be completed before lineman can access production sheet
 */

import React, { useState } from 'react';
import {
  ShieldCheck, HardHat, Eye, Shirt, Hand, AlertTriangle,
  CloudRain, Zap, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { offlineSync } from '../services/offlineSync';

interface SafetyChecklistProps {
  jobId: string;
  onComplete: () => void;
  onCancel: () => void;
  lang?: 'EN' | 'PT' | 'ES';
}

interface ChecklistItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  critical: boolean;
}

const translations = {
  EN: {
    title: 'Safety Checklist',
    subtitle: 'Verify before starting work',
    warning: 'All items must be checked before proceeding',
    ppeSection: 'Personal Protective Equipment',
    conditionsSection: 'Work Conditions',
    items: {
      hardHat: { label: 'Hard Hat', description: 'Wearing approved hard hat' },
      safetyGlasses: { label: 'Safety Glasses', description: 'Eye protection in place' },
      highVis: { label: 'High-Vis Vest', description: 'Reflective vest visible' },
      gloves: { label: 'Work Gloves', description: 'Appropriate gloves for task' },
      weatherOk: { label: 'Weather Conditions', description: 'No lightning, high winds, or ice' },
      areaSecure: { label: 'Work Area Secured', description: 'Cones/barriers in place if needed' },
      powerAwareness: { label: 'Power Line Awareness', description: 'Identified all electrical hazards' },
    },
    confirm: 'I Confirm All Safety Checks',
    cancel: 'Cancel',
    incomplete: 'Complete all safety checks to proceed',
  },
  PT: {
    title: 'Checklist de Segurança',
    subtitle: 'Verifique antes de iniciar o trabalho',
    warning: 'Todos os itens devem ser verificados antes de prosseguir',
    ppeSection: 'Equipamento de Proteção Individual',
    conditionsSection: 'Condições de Trabalho',
    items: {
      hardHat: { label: 'Capacete', description: 'Usando capacete aprovado' },
      safetyGlasses: { label: 'Óculos de Segurança', description: 'Proteção ocular em uso' },
      highVis: { label: 'Colete Refletivo', description: 'Colete visível' },
      gloves: { label: 'Luvas de Trabalho', description: 'Luvas apropriadas para a tarefa' },
      weatherOk: { label: 'Condições Climáticas', description: 'Sem raios, ventos fortes ou gelo' },
      areaSecure: { label: 'Área de Trabalho Segura', description: 'Cones/barreiras posicionados se necessário' },
      powerAwareness: { label: 'Consciência de Linha Elétrica', description: 'Identificados todos os riscos elétricos' },
    },
    confirm: 'Confirmo Todas as Verificações',
    cancel: 'Cancelar',
    incomplete: 'Complete todas as verificações para prosseguir',
  },
  ES: {
    title: 'Lista de Seguridad',
    subtitle: 'Verificar antes de comenzar el trabajo',
    warning: 'Todos los elementos deben verificarse antes de continuar',
    ppeSection: 'Equipo de Protección Personal',
    conditionsSection: 'Condiciones de Trabajo',
    items: {
      hardHat: { label: 'Casco', description: 'Usando casco aprobado' },
      safetyGlasses: { label: 'Gafas de Seguridad', description: 'Protección ocular en uso' },
      highVis: { label: 'Chaleco Reflectante', description: 'Chaleco visible' },
      gloves: { label: 'Guantes de Trabajo', description: 'Guantes apropiados para la tarea' },
      weatherOk: { label: 'Condiciones Climáticas', description: 'Sin rayos, vientos fuertes o hielo' },
      areaSecure: { label: 'Área de Trabajo Segura', description: 'Conos/barreras colocados si es necesario' },
      powerAwareness: { label: 'Conciencia de Línea Eléctrica', description: 'Identificados todos los riesgos eléctricos' },
    },
    confirm: 'Confirmo Todas las Verificaciones',
    cancel: 'Cancelar',
    incomplete: 'Complete todas las verificaciones para continuar',
  }
};

const CHECKLIST_STORAGE_KEY = 'fs_safety_checklists';

// Save completed checklist
const saveChecklistCompletion = (jobId: string, items: string[]): void => {
  try {
    const data = JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY) || '{}');
    data[jobId] = {
      completedAt: new Date().toISOString(),
      items,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // 12 hours
    };
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(data));

    // Queue for sync
    offlineSync.queueOperation('checklist_complete', jobId, { items, completedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Failed to save checklist:', error);
  }
};

// Check if checklist is valid (completed within 12 hours)
export const isChecklistValid = (jobId: string): boolean => {
  try {
    const data = JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY) || '{}');
    const checklist = data[jobId];
    if (!checklist) return false;
    return new Date(checklist.expiresAt) > new Date();
  } catch {
    return false;
  }
};

const SafetyChecklist: React.FC<SafetyChecklistProps> = ({
  jobId,
  onComplete,
  onCancel,
  lang = 'PT'
}) => {
  const t = translations[lang];
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const ppeItems: ChecklistItem[] = [
    { id: 'hardHat', icon: <HardHat className="w-5 h-5" />, ...t.items.hardHat, critical: true },
    { id: 'safetyGlasses', icon: <Eye className="w-5 h-5" />, ...t.items.safetyGlasses, critical: true },
    { id: 'highVis', icon: <Shirt className="w-5 h-5" />, ...t.items.highVis, critical: true },
    { id: 'gloves', icon: <Hand className="w-5 h-5" />, ...t.items.gloves, critical: false },
  ];

  const conditionItems: ChecklistItem[] = [
    { id: 'weatherOk', icon: <CloudRain className="w-5 h-5" />, ...t.items.weatherOk, critical: true },
    { id: 'areaSecure', icon: <AlertTriangle className="w-5 h-5" />, ...t.items.areaSecure, critical: true },
    { id: 'powerAwareness', icon: <Zap className="w-5 h-5" />, ...t.items.powerAwareness, critical: true },
  ];

  const allItems = [...ppeItems, ...conditionItems];
  const allChecked = allItems.every(item => checkedItems.has(item.id));
  const criticalMissing = allItems.filter(item => item.critical && !checkedItems.has(item.id));

  const toggleItem = (id: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedItems(newChecked);
  };

  const handleConfirm = () => {
    if (!allChecked) return;
    saveChecklistCompletion(jobId, Array.from(checkedItems));
    onComplete();
  };

  const renderItem = (item: ChecklistItem) => {
    const isChecked = checkedItems.has(item.id);
    return (
      <button
        key={item.id}
        onClick={() => toggleItem(item.id)}
        className="w-full flex items-center gap-4 p-4 rounded-xl transition-all"
        style={{
          background: isChecked ? 'var(--online-glow)' : 'var(--surface)',
          border: isChecked ? '2px solid var(--online-core)' : '2px solid var(--border-subtle)',
        }}
      >
        <div
          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            background: isChecked ? 'var(--online-core)' : 'var(--elevated)',
            color: isChecked ? 'white' : 'var(--text-tertiary)'
          }}
        >
          {isChecked ? <CheckCircle2 className="w-6 h-6" /> : item.icon}
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span
              className="font-bold"
              style={{ color: isChecked ? 'var(--online-core)' : 'var(--text-primary)' }}
            >
              {item.label}
            </span>
            {item.critical && !isChecked && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                style={{ background: 'var(--energy-pulse)', color: 'var(--energy-core)' }}
              >
                {lang === 'PT' ? 'OBRIGATÓRIO' : lang === 'ES' ? 'REQUERIDO' : 'REQUIRED'}
              </span>
            )}
          </div>
          <span className="text-xs" style={{ color: 'var(--text-ghost)' }}>{item.description}</span>
        </div>
        <ChevronRight
          className="w-5 h-5 transition-transform"
          style={{
            color: isChecked ? 'var(--online-core)' : 'var(--text-ghost)',
            transform: isChecked ? 'rotate(90deg)' : 'none'
          }}
        />
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[150] backdrop-blur-xl flex flex-col animate-in fade-in duration-300"
      style={{ background: 'var(--void)', opacity: 0.98 }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 p-6 text-center"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'var(--surface)', color: 'var(--text-tertiary)' }}
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
          style={{ background: 'var(--gradient-neural)' }}
        >
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <h1
          className="text-2xl font-black"
          style={{ color: 'var(--text-primary)' }}
        >
          {t.title}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{t.subtitle}</p>
      </div>

      {/* Warning */}
      <div
        className="px-4 py-3"
        style={{ background: 'var(--energy-pulse)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <p
          className="text-xs text-center font-bold flex items-center justify-center gap-2"
          style={{ color: 'var(--energy-core)' }}
        >
          <AlertTriangle className="w-4 h-4" />
          {t.warning}
        </p>
      </div>

      {/* Checklist */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* PPE Section */}
        <div>
          <h3
            className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 px-2"
            style={{ color: 'var(--text-ghost)' }}
          >
            {t.ppeSection}
          </h3>
          <div className="space-y-2">
            {ppeItems.map(renderItem)}
          </div>
        </div>

        {/* Conditions Section */}
        <div>
          <h3
            className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3 px-2"
            style={{ color: 'var(--text-ghost)' }}
          >
            {t.conditionsSection}
          </h3>
          <div className="space-y-2">
            {conditionItems.map(renderItem)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex-shrink-0 p-4 space-y-3"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        {!allChecked && criticalMissing.length > 0 && (
          <p className="text-xs text-center" style={{ color: 'var(--energy-core)' }}>{t.incomplete}</p>
        )}

        <button
          onClick={handleConfirm}
          disabled={!allChecked}
          className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          style={{
            background: allChecked ? 'var(--gradient-neural)' : 'var(--surface)',
            color: allChecked ? 'var(--void)' : 'var(--text-ghost)',
            cursor: allChecked ? 'pointer' : 'not-allowed',
            transform: allChecked ? 'scale(1)' : 'scale(1)',
          }}
          onMouseEnter={(e) => allChecked && (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <ShieldCheck className="w-5 h-5" />
          {t.confirm}
        </button>

        <button
          onClick={onCancel}
          className="w-full py-3 rounded-xl font-bold transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
};

export default SafetyChecklist;
