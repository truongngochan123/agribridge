-- Fix mismatched province/ward for suppliers whose ward does not belong to their stated province.
-- Symptom: province=Tỉnh Gia Lai, ward=Phường Quy Nhơn → Quy Nhơn belongs to Bình Định, not Gia Lai.
-- Correct the province to Bình Định (where Quy Nhơn actually is).

UPDATE companies
SET province = N'Bình Định'
WHERE province = N'Tỉnh Gia Lai'
  AND ward LIKE N'%Quy Nhơn%';

-- Also fix bare "Gia Lai" (without prefix) that has a Quy Nhon ward
UPDATE companies
SET province = N'Bình Định'
WHERE province = N'Gia Lai'
  AND ward LIKE N'%Quy Nhơn%';
