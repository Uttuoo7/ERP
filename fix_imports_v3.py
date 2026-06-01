import os

src_dir = r"C:\Users\ASUS\.gemini\antigravity\scratch\P2P_ERP\frontend\src"

# 1. Create Card.tsx
card_content = """import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm ${className}`} {...props}>{children}</div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`p-6 border-b border-zinc-100 dark:border-zinc-800/50 ${className}`} {...props}>{children}</div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className = '', ...props }) => (
  <h3 className={`text-lg font-semibold text-zinc-900 dark:text-zinc-50 ${className}`} {...props}>{children}</h3>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
  <div className={`p-6 ${className}`} {...props}>{children}</div>
);
"""

card_path = os.path.join(src_dir, "components", "ui", "Card.tsx")
os.makedirs(os.path.dirname(card_path), exist_ok=True)
with open(card_path, "w", encoding="utf-8") as f:
    f.write(card_content)
print(f"Created {card_path}")

# 2. Create AuthContext.tsx
auth_context_content = """import React from 'react';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
"""
auth_context_path = os.path.join(src_dir, "components", "layout", "AuthContext.tsx")
os.makedirs(os.path.dirname(auth_context_path), exist_ok=True)
with open(auth_context_path, "w", encoding="utf-8") as f:
    f.write(auth_context_content)
print(f"Created {auth_context_path}")

# 3. Heal files
for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith((".tsx", ".ts")):
            filepath = os.path.join(root, file)
            rel = os.path.relpath(filepath, src_dir).replace('\\', '/')
            depth = rel.count('/')
            
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                
            original = content
            
            # Correct api path string based on depth
            api_rel = "../" * depth + "api"
            
            content = content.replace("../../services/api", api_rel)
            content = content.replace("../services/api", api_rel)
            
            # RecommendationDashboard special replacement
            if "RecommendationDashboard.tsx" in filepath:
                content = content.replace("../../api", "../api")
            
            # App.tsx fixes
            if file == "App.tsx":
                content = content.replace("import { ObservabilityDashboard } from './pages/ObservabilityDashboard';", "")
                content = content.replace('import { ObservabilityDashboard } from "./pages/ObservabilityDashboard";', "")
                content = content.replace('import("./pages/admin/DataMigrationWizard")', 'import("./pages/DataMigrationWizard")')
                content = content.replace('import("./pages/admin/ImportHistoryDashboard")', 'import("./pages/ImportHistoryDashboard")')
                content = content.replace("import('./pages/admin/DataMigrationWizard')", "import('./pages/DataMigrationWizard')")
                content = content.replace("import('./pages/admin/ImportHistoryDashboard')", "import('./pages/ImportHistoryDashboard')")
                content = content.replace("import { AuthProvider } from './components/layout/AuthContext';", "import { AuthProvider } from './AuthContext';")
                content = content.replace('import { AuthProvider } from "./components/layout/AuthContext";', "import { AuthProvider } from './AuthContext';")

            # SidebarLink fixes inside components/layout/
            if file == "Sidebar.tsx":
                content = content.replace('from "../../store/authStore"', 'from "../../store/authStore"')

            if content != original:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"Fixed {rel} with api_rel={api_rel}")

print("Healing pass complete!")
