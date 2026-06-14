/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        erp: {
          primary: '#1E40AF',
          secondary: '#475569',
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          border: '#E2E8F0',
        },
        status: {
          success: { bg: '#DCFCE7', text: '#166534' },
          error: { bg: '#FEE2E2', text: '#991B1B' },
          warning: { bg: '#FEF3C7', text: '#92400E' },
          info: { bg: '#DBEAFE', text: '#1E40AF' },
          neutral: { bg: '#F1F5F9', text: '#475569' },
        }
      },
      borderRadius: {
        'erp': '0.375rem',
      },
      boxShadow: {
        'erp': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'erp-card': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
      spacing: {
        'table-px': '0.75rem',
        'table-py': '0.5rem',
        'form-px': '0.75rem',
        'form-py': '0.375rem',
      }
    },
  },
  plugins: [],
}
