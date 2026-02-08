/**
 * ProductionDataCard - Shows FULL production submission with entries table
 * This is the complete lineman production data, not just a summary
 */

import React, { useState } from 'react';
import { CheckCircle2, Ruler, Anchor, Circle, Snowflake, ChevronDown, ChevronUp, Calendar, User, MessageSquare } from 'lucide-react';
import { Language } from '../../types';

interface ProductionEntry {
  spanFeet: number;
  anchor: boolean;
  fiberNumber: string;
  coil: boolean;
  snowshoe: boolean;
  notes?: string;
}

interface ProductionData {
  submittedAt: string;
  completedDate?: string;
  totalFootage: number;
  anchorCount: number;
  coilCount: number;
  snowshoeCount: number;
  entries?: ProductionEntry[];
  comments?: string;
  linemanNotes?: string;
}

interface Props {
  productionData: ProductionData;
  linemanName?: string;
  lang?: Language;
}

const CheckMark = ({ color = 'var(--neural-core)' }: { color?: string }) => (
  <div
    className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
    style={{ background: color }}
  >
    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  </div>
);

export const ProductionDataCard: React.FC<Props> = ({ productionData, linemanName, lang = 'EN' }) => {
  const [showEntries, setShowEntries] = useState(true);
  const entries = productionData.entries || [];
  const comments = productionData.comments || productionData.linemanNotes;

  const t = {
    EN: {
      title: 'Submitted Production Data',
      totalFeet: 'Total Feet',
      anchors: 'Anchors',
      coils: 'Coils',
      snowshoes: 'Snowshoes',
      entries: 'Production Entries',
      showEntries: 'Show Details',
      hideEntries: 'Hide Details',
      span: 'Span (ft)',
      anchor: 'Anchor',
      fiberNum: 'Fiber #',
      coil: 'Coil',
      snowshoe: 'Snowshoe',
      notes: 'Notes',
      total: 'TOTAL',
      completedDate: 'Completed',
      submittedAt: 'Submitted',
      lineman: 'Lineman',
      comments: 'Lineman Comments'
    },
    PT: {
      title: 'Dados de Produção Enviados',
      totalFeet: 'Metragem Total',
      anchors: 'Âncoras',
      coils: 'Bobinas',
      snowshoes: 'Snowshoes',
      entries: 'Entradas de Produção',
      showEntries: 'Mostrar Detalhes',
      hideEntries: 'Ocultar Detalhes',
      span: 'Span (ft)',
      anchor: 'Âncora',
      fiberNum: 'Fibra #',
      coil: 'Bobina',
      snowshoe: 'Snowshoe',
      notes: 'Notas',
      total: 'TOTAL',
      completedDate: 'Concluído',
      submittedAt: 'Enviado',
      lineman: 'Lineman',
      comments: 'Comentários do Lineman'
    },
    ES: {
      title: 'Datos de Producción Enviados',
      totalFeet: 'Metraje Total',
      anchors: 'Anclas',
      coils: 'Bobinas',
      snowshoes: 'Snowshoes',
      entries: 'Entradas de Producción',
      showEntries: 'Mostrar Detalles',
      hideEntries: 'Ocultar Detalles',
      span: 'Span (ft)',
      anchor: 'Ancla',
      fiberNum: 'Fibra #',
      coil: 'Bobina',
      snowshoe: 'Snowshoe',
      notes: 'Notas',
      total: 'TOTAL',
      completedDate: 'Completado',
      submittedAt: 'Enviado',
      lineman: 'Lineman',
      comments: 'Comentarios del Lineman'
    }
  };

  const labels = t[lang] || t.EN;

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-online)' }}
    >
      {/* Header */}
      <h3 className="text-xs font-bold uppercase tracking-wider mb-6 flex items-center gap-2" style={{ color: 'var(--online-core)' }}>
        <CheckCircle2 className="w-4 h-4" />
        {labels.title}
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
          <Ruler className="w-5 h-5 mb-2" style={{ color: 'var(--neural-core)' }} />
          <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            {productionData.totalFootage.toLocaleString()}
          </p>
          <p className="text-[9px] uppercase font-bold" style={{ color: 'var(--text-ghost)' }}>
            {labels.totalFeet}
          </p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
          <Anchor className="w-5 h-5 mb-2" style={{ color: 'var(--energy-core)' }} />
          <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            {productionData.anchorCount}
          </p>
          <p className="text-[9px] uppercase font-bold" style={{ color: 'var(--text-ghost)' }}>
            {labels.anchors}
          </p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
          <Circle className="w-5 h-5 mb-2" style={{ color: 'var(--online-core)' }} />
          <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            {productionData.coilCount}
          </p>
          <p className="text-[9px] uppercase font-bold" style={{ color: 'var(--text-ghost)' }}>
            {labels.coils}
          </p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
          <Snowflake className="w-5 h-5 mb-2" style={{ color: 'var(--alert-core)' }} />
          <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            {productionData.snowshoeCount}
          </p>
          <p className="text-[9px] uppercase font-bold" style={{ color: 'var(--text-ghost)' }}>
            {labels.snowshoes}
          </p>
        </div>
      </div>

      {/* Entries Table Toggle */}
      {entries.length > 0 && (
        <>
          <button
            onClick={() => setShowEntries(!showEntries)}
            className="w-full flex items-center justify-between p-3 rounded-xl mb-4 transition-colors"
            style={{ background: 'var(--elevated)' }}
          >
            <span className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
              {labels.entries} ({entries.length})
            </span>
            {showEntries ? (
              <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            ) : (
              <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            )}
          </button>

          {/* Entries Table - FULL DATA */}
          {showEntries && (
            <div className="overflow-x-auto rounded-xl mb-4" style={{ border: '1px solid var(--border-default)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--elevated)' }}>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>#</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{labels.span}</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{labels.anchor}</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{labels.fiberNum}</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{labels.coil}</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{labels.snowshoe}</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{labels.notes}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr
                      key={index}
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-ghost)' }}>{index + 1}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{entry.spanFeet}</td>
                      <td className="px-4 py-3 text-center">
                        {entry.anchor && <CheckMark color="var(--neural-core)" />}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{entry.fiberNumber || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {entry.coil && <CheckMark color="var(--online-core)" />}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.snowshoe && <CheckMark color="var(--alert-core)" />}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-tertiary)' }}>{entry.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--elevated)' }}>
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-ghost)' }}>{labels.total}</td>
                    <td className="px-4 py-3 font-black text-lg" style={{ color: 'var(--neural-core)' }}>{productionData.totalFootage} ft</td>
                    <td className="px-4 py-3 text-center font-bold" style={{ color: 'var(--neural-core)' }}>{productionData.anchorCount}</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-center font-bold" style={{ color: 'var(--online-core)' }}>{productionData.coilCount}</td>
                    <td className="px-4 py-3 text-center font-bold" style={{ color: 'var(--alert-core)' }}>{productionData.snowshoeCount}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* Comments */}
      {comments && (
        <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--elevated)' }}>
          <p className="text-[10px] font-bold uppercase mb-2 flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
            <MessageSquare className="w-3 h-3" />
            {labels.comments}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{comments}</p>
        </div>
      )}

      {/* Metadata Footer */}
      <div className="flex flex-wrap gap-4 text-xs" style={{ color: 'var(--text-ghost)' }}>
        {linemanName && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {labels.lineman}: {linemanName}
          </span>
        )}
        {productionData.completedDate && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {labels.completedDate}: {new Date(productionData.completedDate).toLocaleDateString()}
          </span>
        )}
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {labels.submittedAt}: {new Date(productionData.submittedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default ProductionDataCard;
