import os
import shutil
import zipfile

def copy_dist_to_assets():
    dist_dir = 'dist'
    target_dir = 'android/app/src/main/assets/www'
    if os.path.exists(target_dir):
        shutil.rmtree(target_dir)
    os.makedirs(target_dir, exist_ok=True)
    if os.path.exists(dist_dir):
        for item in os.listdir(dist_dir):
            if item.endswith('.zip') or item.endswith('.mp4') or 'test_' in item or item == 'aistudio':
                continue
            s = os.path.join(dist_dir, item)
            d = os.path.join(target_dir, item)
            if os.path.isdir(s):
                shutil.copytree(s, d, ignore=shutil.ignore_patterns('*.zip', '*.mp4', 'test_*', 'aistudio*'))
            else:
                shutil.copy2(s, d)
    print("Copied clean web assets to Android www.")

def zip_directory(source_dir, output_zip, exclude_dir_names=None, exclude_extensions=None):
    exclude_dir_names = set(exclude_dir_names or ['.gradle', 'build', '.idea', 'node_modules', '.git', 'dist'])
    exclude_extensions = tuple(exclude_extensions or ['.mp4', '.zip'])
    
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Exclude directory names exactly
            dirs[:] = [d for d in dirs if d not in exclude_dir_names and not d.startswith('.git')]
            for file in files:
                if file.endswith(exclude_extensions):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, rel_path)
    size_mb = os.path.getsize(output_zip) / (1024 * 1024)
    print(f"Created {output_zip} ({size_mb:.2f} MB)")

if __name__ == '__main__':
    copy_dist_to_assets()
    # 1. Android Studio Project Package
    zip_directory('android', 'public/seraph-android-project.zip', 
                  exclude_dir_names=['.gradle', 'build', '.idea'],
                  exclude_extensions=['.mp4', '.zip'])
    
    # 2. Web Production Build Package (Ready for Vercel, Netlify, Cloudflare Pages, cPanel)
    zip_directory('dist', 'public/seraph-web-dist.zip',
                  exclude_dir_names=['.gradle', 'build', '.idea'],
                  exclude_extensions=['.mp4', '.zip'])

    # 3. Full Source Code Package
    zip_directory('.', 'public/seraph-full-source.zip',
                  exclude_dir_names=['node_modules', '.git', 'dist', '.gradle', 'build', '.idea'],
                  exclude_extensions=['.mp4', '.zip'])
    print("Done packaging.")
