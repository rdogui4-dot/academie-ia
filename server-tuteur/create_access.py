"""Outil administrateur local : ne pas enregistrer la sortie dans Git."""
import hashlib
import secrets

if __name__ == '__main__':
    token = secrets.token_urlsafe(32)
    print('Code à remettre uniquement à l’apprenant :', token)
    print('Hash à ajouter à TUTOR_ACCESS_HASHES :', hashlib.sha256(token.encode()).hexdigest())
