UNIDADES = ['cero', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
DIEZ_DIECINUEVE = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve']
DECENAS = ['veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
CIENTOS = ['cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']


def numero_a_letras(n):
    if n < 0:
        return 'menos ' + numero_a_letras(-n)

    entero = int(n)
    decimal = round((n - entero) * 100)

    if entero == 0:
        letras = 'cero'
    else:
        letras = _convertir_entero(entero)

    if decimal > 0:
        letras += f' con {decimal:02d}/100'
    else:
        letras += ' con 00/100'

    return letras.capitalize()


def _convertir_entero(n):
    if n < 10:
        return UNIDADES[n] if n != 1 else 'un'
    if n < 20:
        return DIEZ_DIECINUEVE[n - 10]
    if n < 100:
        d = n // 10
        u = n % 10
        if u == 0:
            return DECENAS[d - 2]
        if d == 2:
            return 'veinti' + UNIDADES[u]
        return DECENAS[d - 2] + ' y ' + (UNIDADES[u] if u != 1 else 'un')
    if n < 1000:
        c = n // 100
        r = n % 100
        if c == 1 and r == 0:
            return 'cien'
        if c == 1:
            return 'ciento ' + _convertir_entero(r)
        if r == 0:
            return CIENTOS[c - 1]
        return CIENTOS[c - 1] + ' ' + _convertir_entero(r)
    if n < 1000000:
        m = n // 1000
        r = n % 1000
        m_str = _convertir_entero(m) if m != 1 else 'mil'
        if r == 0:
            return m_str + ' mil'
        return m_str + ' mil ' + _convertir_entero(r)

    return str(n)
