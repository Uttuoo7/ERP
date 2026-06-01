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

# 2. Scan and replace imports
replacements = {
    '../../services/api': '../../api',
    '../services/api': '../api',
    '../../api"': '../api"',
    '../../api\'': '../api\'',
    '"../components/ui/enterprise/ScannerOverlay"': '"../../components/ui/enterprise/ScannerOverlay"',
    "'../components/ui/enterprise/ScannerOverlay'": "'../../components/ui/enterprise/ScannerOverlay'",
}

# RecommendationDashboard.tsx specifically:
# import { get, post } from "../../api"; -> should be ../api
# Let's handle general file replacement

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith((".tsx", ".ts")):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            
            original = content
            
            # RecommendationDashboard special replacement
            if "RecommendationDashboard.tsx" in filepath:
                content = content.replace('from "../../api"', 'from "../api"')
                content = content.replace("from '../../api'", "from '../api'")
            
            for old, new in replacements.items():
                content = content.replace(old, new)
            
            if content != original:
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"Fixed imports in {filepath}")

print("Import fix complete!")
