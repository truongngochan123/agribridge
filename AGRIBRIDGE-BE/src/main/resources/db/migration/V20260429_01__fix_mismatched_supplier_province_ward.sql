-- Fix mismatched province/ward for suppliers whose ward does not belong to their stated province.
-- Symptom: province=Tỉnh Gia Lai, ward=Phường Quy Nhơn → Quy Nhơn belongs to Bình Định, not Gia Lai.
-- Correct the province to Bình Định (where Quy Nhơn actually is).

-- Case 1: "Tỉnh Gia Lai" with any Quy Nhơn ward
UPDATE companies
SET province = N'Bình Định'
WHERE province = N'Tỉnh Gia Lai'
  AND ward LIKE N'%Quy Nhơn%';

-- Case 2: bare "Gia Lai" (without prefix)
UPDATE companies
SET province = N'Bình Định'
WHERE province = N'Gia Lai'
  AND ward LIKE N'%Quy Nhơn%';

-- Case 3: strip "Tỉnh " prefix from any province that starts with it for consistency
UPDATE companies
SET province = SUBSTRING(province, 6, LEN(province) - 5)
WHERE province LIKE N'Tỉnh %'
  AND province NOT IN (N'Tỉnh Bình Định'); -- keep ones already correct
