from config import load_config
from scanner import scan_all_folders
from file_store import save_files


def main():
    folders = load_config()
    files = scan_all_folders(folders)

    save_files(files)


if __name__ == "__main__":
    main()