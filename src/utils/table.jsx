import React from 'react';

const DataTable = ({ data, priceField }) => (
  <div className="w-full max-w-xs bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" style={{ height: 300 }}>
    <table className="min-w-full text-sm text-left h-full flex flex-col">
      <thead className="flex-none">
        <tr className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow flex w-full">
          <th className="px-4 py-3 font-semibold flex-1">{priceField.charAt(0).toUpperCase() + priceField.slice(1)}</th>
          <th className="px-4 py-3 font-semibold flex-1">Volume</th>
        </tr>
      </thead>
      <tbody className="flex-1 block overflow-y-auto">
        {data.map((row, idx) => (
          <tr
            key={idx}
            className={`flex w-full transition-colors duration-150 ${
              idx % 2 === 0 ? 'bg-cyan-50' : 'bg-white'
            } hover:bg-cyan-100`}
          >
            <td className="px-4 py-2 font-medium text-gray-700 flex-1">{row[priceField]}</td>
            <td className="px-4 py-2 text-cyan-700 font-semibold flex-1">{row.Volume}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="flex-none">
        <tr className="bg-gradient-to-r from-cyan-100 to-blue-100 font-bold text-cyan-900 border-t-2 border-cyan-300 flex w-full">
          <td className="px-4 py-2 flex-1">Total</td>
          <td className="px-4 py-2 flex-1">
            {data.reduce((sum, row) => sum + Number(row.Volume), 0)}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
);

export default DataTable;